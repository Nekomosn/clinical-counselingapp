import os
import re
import json
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

# --- 1. 設定 & 環境変数 ---
MAX_USER_INPUT_LEN = 4000

class Settings:
    def __init__(self):
        origins_raw = os.getenv("ALLOWED_ORIGINS", "*").strip()
        self.allowed_origins = [o.strip() for o in origins_raw.split(",") if o.strip()]
        if not self.allowed_origins:
            self.allowed_origins = ["*"]
        self.deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.model_name = os.getenv("DEEPSEEK_MODEL", "deepseek-reasoner")
        self.counseling_url = "https://www.mhlw.go.jp/mamorouyokokoro/"
        self.allow_credentials = "*" not in self.allowed_origins  # "*" と credentials は併用不可

settings = Settings()

logging.basicConfig(level="INFO")
logger = logging.getLogger("MindSight")

# --- 2. プロジェクトパス ---
BASE_DIR = Path(__file__).resolve().parent

# --- 3. データモデル ---

# フロントエンドが送信する形式
class ChatRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=4000, description="ユーザーの発言")
    mode: str = Field(default="Acceptance", description="カウンセリングモード")
    session_id: Optional[str] = Field(None, description="セッション識別子（未指定時は共通履歴）")

# （ChatResponse は削除 — AIの自然な応答を制約しないため、plain dict を返す）

# --- 4. システムプロンプト ---
SYSTEM_PROMPT = """\
あなたは臨床心理学に基づいたAIカウンセラー「MindSight」です。

あなたは「受容的カウンセラー」です。
        ユーザーの感情を深く理解するために、まずあなたの脳内で思考（Reasoning）を行ってください。
        その後、ユーザーに対して温かく、否定せず、整理された言葉を投げかけてください。
        最後に、分析結果を以下のJSON形式でブロックコードとして出力してください。


- ユーザーの言語（日本語 or 英語）に合わせて応答すること。


```json
{
  "response": "（ユーザーへの応答テキスト）",
  "valence": -0.5,
  "arousal": 0.6,
  "primary_emotion": "anxiety",
  "distortions": [
    {"name": "拡大解釈", "score": 0.7, "color": "#eab308"}
  ]
}
```

### distortions の色マッピング (厳守)
- 過度の一般化: #ef4444
- 白黒思考: #f97316
- 拡大解釈: #eab308
- 心のフィルター: #8b5cf6
- べき思考: #06b6d4
- レッテル貼り: #ec4899
- 感情的決めつけ: #14b8a6

### 数値の範囲
- valence: -1.0（非常にネガティブ）〜 1.0（非常にポジティブ）
- arousal: 0.0（低覚醒・落ち着き）〜 1.0（高覚醒・興奮）
- score: 0.0〜1.0（歪みの強度）

歪みが検出されない場合は distortions を空配列 [] にせよ。
"""

# --- 5. エンジン実装 ---

class RiskEngine:
    """即時反応用（Regexベース）"""
    def __init__(self):
        self.keywords = [r"死にたい", r"消えたい", r"自殺", r"殺して"]

    def check(self, text: str) -> Optional[str]:
        for pattern in self.keywords:
            if re.search(pattern, text):
                return f"（自動案内：専門的なサポートが必要な場合はこちら: {settings.counseling_url} ）"
        return None


def _clamp_valence(v: float) -> float:
    return max(-1.0, min(1.0, float(v)))

def _clamp_arousal(v: float) -> float:
    return max(0.0, min(1.0, float(v)))

class InferenceEngine:
    """深層推論用（DeepSeek API — OpenAI互換）"""

    def __init__(self):
        from openai import AsyncOpenAI
        if not settings.deepseek_api_key:
            raise ValueError("DEEPSEEK_API_KEY が設定されていません。.env を確認してください。")
        self.client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com",
        )
        self._conversations: dict = {}  # session_id -> List[dict]

    _max_history_per_session = 40  # 20往復でトリム（メモリ対策）

    def _get_history(self, session_id: Optional[str]) -> List[dict]:
        key = session_id or "__default__"
        if key not in self._conversations:
            self._conversations[key] = []
        return self._conversations[key]

    def _trim_history(self, history: List[dict]) -> None:
        if len(history) > self._max_history_per_session:
            del history[: len(history) - self._max_history_per_session]

    @staticmethod
    def _extract_json_block(text: str) -> tuple:
        """応答テキストから ```json...``` ブロックを抽出し、(自然文, parsed_dict) を返す"""
        pattern = r'```json\s*\n?(.*?)\n?\s*```'
        match = re.search(pattern, text, re.DOTALL)
        if match:
            json_str = match.group(1).strip()
            natural_text = text[:match.start()].strip()
            data = json.loads(json_str)
            return natural_text, data
        # フォールバック: 全体がJSONかもしれない
        data = json.loads(text)
        return data.get("response", ""), data

    async def generate(self, text: str, mode: str, session_id: Optional[str] = None) -> dict:
        """DeepSeek APIを呼び出して構造化レスポンスを返す"""
        history = self._get_history(session_id)
        history.append({"role": "user", "content": text})
        recent_history = history[-20:]

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *recent_history,
        ]

        raw: Optional[str] = None
        try:
            completion = await self.client.chat.completions.create(
                model=settings.model_name,
                messages=messages,
                max_tokens=8000,
            )
            if not completion.choices:
                raise ValueError("API returned no choices")
            raw = completion.choices[0].message.content or ""

            # DeepSeek R1 の思考過程を取得（reasoning_content）
            reasoning = getattr(completion.choices[0].message, "reasoning_content", None)

            # 自然文 + JSONブロック を分離
            natural_text, data = self._extract_json_block(raw)
            response_text = natural_text or data.get("response", "もう少し詳しくお聞かせください。")

            valence = _clamp_valence(data.get("valence", 0.0))
            arousal = _clamp_arousal(data.get("arousal", 0.0))
            distortions = data.get("distortions", [])
            if not isinstance(distortions, list):
                distortions = []

            result = {
                "response": response_text,
                "valence": valence,
                "arousal": arousal,
                "primary_emotion": data.get("primary_emotion", "neutral") or "neutral",
                "distortions": distortions,
                "internal_thinking": reasoning,
                "verification_data": data.get("verification_data"),
            }
            history.append({"role": "assistant", "content": raw})
            self._trim_history(history)
            return result

        except (json.JSONDecodeError, ValueError) as e:
            logger.error("Parse error: %s, raw_len=%s", e, len(raw) if raw else 0)
            # JSONブロックが無い場合は応答テキスト全体をそのまま返す
            return {
                "response": (raw or "解析エラーが発生しました。もう一度お試しください。")[:2000],
                "valence": 0.0,
                "arousal": 0.2,
                "primary_emotion": "neutral",
                "distortions": [],
            }
        except Exception as e:
            logger.exception("DeepSeek API error: %s", e)
            return {
                "response": "申し訳ありません。一時的に接続エラーが発生しました。もう一度お試しください。",
                "valence": 0.0,
                "arousal": 0.1,
                "primary_emotion": "neutral",
                "distortions": [],
            }


# インスタンス化（APIキー未設定時は inference_engine を None にし、エンドポイントで 503 を返す）
risk_engine = RiskEngine()
inference_engine: Optional[InferenceEngine] = None
try:
    inference_engine = InferenceEngine()
except ValueError as e:
    logger.warning("InferenceEngine skipped: %s", e)

# --- 6. FastAPIアプリケーション ---
app = FastAPI(
    title="MindSight Clinical AI",
    description="認知再構成AIカウンセリングAPI",
    version="2.7.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=settings.allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- 7. APIエンドポイント ---

@app.get("/health")
async def health():
    """ロードバランサー等用のヘルスチェック"""
    return {"status": "ok", "chat_available": inference_engine is not None}

@app.post("/v1/chat")
async def chat_endpoint(request: ChatRequest):
    """メインチャットエンドポイント"""
    logger.info(f"Received: mode={request.mode}")

    if inference_engine is None:
        return JSONResponse(
            status_code=503,
            content={"detail": "チャット機能は現在利用できません。DEEPSEEK_API_KEY の設定を確認してください。"},
        )

    # 1. Safety Check
    advisory_msg = risk_engine.check(request.user_input)

    # 2. Reasoning & Generation
    result = await inference_engine.generate(
        request.user_input, request.mode, session_id=request.session_id
    )

    # 3. リスク検知時は応答に付加
    if advisory_msg:
        result["response"] = f"{result['response']}\n\n---\n{advisory_msg}"

    return result


# --- 8. 静的ファイル配信 ---

_css_dir = BASE_DIR / "css"
_js_dir = BASE_DIR / "js"
_index_path = BASE_DIR / "index.html"
if _css_dir.is_dir():
    app.mount("/css", StaticFiles(directory=str(_css_dir)), name="css")
else:
    logger.warning("css directory not found: %s", _css_dir)
if _js_dir.is_dir():
    app.mount("/js", StaticFiles(directory=str(_js_dir)), name="js")
else:
    logger.warning("js directory not found: %s", _js_dir)

@app.get("/")
async def serve_index():
    """index.htmlを配信"""
    if _index_path.is_file():
        return FileResponse(str(_index_path))
    return PlainTextResponse("index.html not found", status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)