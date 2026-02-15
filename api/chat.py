# Vercel Serverless Function — /v1/chat endpoint
# This file mirrors the logic in main.py but as a Vercel-compatible handler.

import os
import re
import json
import logging
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# --- Settings ---
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
MODEL_NAME = os.getenv("DEEPSEEK_MODEL", "deepseek-reasoner")
COUNSELING_URL = "https://www.mhlw.go.jp/mamorouyokokoro/"

logging.basicConfig(level="INFO")
logger = logging.getLogger("MindSight")

def _clamp_valence(v: float) -> float:
    return max(-1.0, min(1.0, float(v)))

def _clamp_arousal(v: float) -> float:
    return max(0.0, min(1.0, float(v)))

# --- Data Models ---
class ChatRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=4000, description="ユーザーの発言")
    mode: str = Field(default="Acceptance", description="カウンセリングモード")

# （ChatResponse 削除 — plain dict を返す）

# --- System Prompt ---
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

# --- Risk Engine ---
RISK_KEYWORDS = [r"死にたい", r"消えたい", r"自殺", r"殺して"]

def check_risk(text: str) -> Optional[str]:
    for pattern in RISK_KEYWORDS:
        if re.search(pattern, text):
            return f"（自動案内：専門的なサポートが必要な場合はこちら: {COUNSELING_URL} ）"
    return None

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

# --- FastAPI App ---
app = FastAPI()

# allow_credentials=True は allow_origins="*" と併用不可（ブラウザ仕様）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/v1/chat")
async def chat_endpoint(request: ChatRequest):
    """メインチャットエンドポイント (Vercel Serverless)"""
    logger.info(f"Received: mode={request.mode}")

    if not DEEPSEEK_API_KEY:
        return JSONResponse(
            status_code=503,
            content={"detail": "チャット機能は現在利用できません。DEEPSEEK_API_KEY の設定を確認してください。"},
        )

    # 1. Safety Check
    advisory_msg = check_risk(request.user_input)

    raw: Optional[str] = None
    try:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com",
        )

        completion = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": request.user_input},
            ],
            max_tokens=8000,
        )

        if not completion.choices:
            raise ValueError("API returned no choices")
        raw = completion.choices[0].message.content or ""

        # DeepSeek R1 の思考過程を取得（reasoning_content）
        reasoning = getattr(completion.choices[0].message, "reasoning_content", None)

        # 自然文 + JSONブロック を分離
        natural_text, data = _extract_json_block(raw)
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
            "primary_emotion": (data.get("primary_emotion") or "neutral"),
            "distortions": distortions,
            "internal_thinking": reasoning,
            "verification_data": data.get("verification_data"),
        }

    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Parse error: %s, raw_len=%s", e, len(raw) if raw else 0)
        result = {
            "response": (raw or "解析エラーが発生しました。もう一度お試しください。")[:2000],
            "valence": 0.0,
            "arousal": 0.2,
            "primary_emotion": "neutral",
            "distortions": [],
        }
    except Exception as e:
        logger.exception("DeepSeek API error: %s", e)
        result = {
            "response": "申し訳ありません。一時的に接続エラーが発生しました。もう一度お試しください。",
            "valence": 0.0,
            "arousal": 0.1,
            "primary_emotion": "neutral",
            "distortions": [],
        }

    # 3. Append risk advisory if needed
    if advisory_msg:
        result["response"] = f"{result['response']}\n\n---\n{advisory_msg}"

    return result


# Vercel handler
handler = app
