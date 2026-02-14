import os
import re
import json
import logging
import asyncio
from typing import List, Optional, Literal
from enum import Enum

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# 本番では openai ライブラリを使用
# import openai 

load_dotenv()

# --- 1. 設定 & 環境変数 ---
class Settings:
    def __init__(self):
        self.allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.model_name = "gpt-4-turbo" # JSONモードが安定しているモデル推奨
        self.counseling_url = "https://www.mhlw.go.jp/mamorouyokokoro/"

settings = Settings()

# ロガー設定
logging.basicConfig(level="INFO")
logger = logging.getLogger("ReasoningEngine")

# --- 2. データモデル (推論プロトコル定義) ---

# モード定義
class InteractionMode(str, Enum):
    NORMAL = "normal"         # 通常：論理的バリデーション
    INTERVENTION = "intervention" # 介入：認知の歪みへの問いかけ

# 推論：構成要素分析
class ComponentAnalysis(BaseModel):
    facts: List[str] = Field(..., description="発言に含まれる客観的事実・固有名詞")
    variables: List[str] = Field(..., description="操作可能な変数（人間関係、経済状態など）")

# 推論：身体的マッピング
class SomaticMapping(BaseModel):
    valence: float = Field(..., description="快(-1.0) 〜 不快(1.0) の数値化", ge=-1.0, le=1.0)
    arousal: float = Field(..., description="覚醒度(0.0) 〜 興奮(1.0) の数値化", ge=0.0, le=1.0)

# 推論：スキーマ検知 & 戦略
class ReasoningLog(BaseModel):
    component_analysis: ComponentAnalysis
    somatic_mapping: SomaticMapping
    schema_detection: List[str] = Field(..., description="検知された認知の歪みリスト")
    strategic_formulation: str = Field(..., description="応答構成の意図")

# APIリクエスト
class ChatRequest(BaseModel):
    user_id: str
    text: str = Field(..., example="彼に浮気されて、もう何も信じられない。")
    mode: InteractionMode = InteractionMode.NORMAL

# APIレスポンス (統合版)
class AdvisoryData(BaseModel):
    required: bool
    message: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    reasoning: ReasoningLog  # フロントエンドで思考過程を可視化可能にする
    advisory: AdvisoryData

# --- 3. システムプロンプト (The Protocol) ---
SYSTEM_PROMPT = """
## Thinking Protocol (厳守)
あなたの内部推論は、以下の4ステップで必ず【日本語】で行え。

1. **Component Analysis**: 発言に含まれる事実（固有名詞・出来事）と変数（経済状態・人間関係など）を抽出せよ。
2. **Somatic Mapping**: Valence（快-不快）とArousal（覚醒度）を、生体システム的な観点から数値化せよ。
3. **Schema Detection**: 認知の歪みを「歪みリスト」から同定し、論理エラーとしてラベル付けせよ（例: 破滅化、過度の一般化）。
4. **Strategic Formulation**: ユーザーの言語に合わせた最適な応答構成（事実の承認 → 分析の提示）を策定せよ。

## 応答生成ルール
- **通常モード**: 論理的バリデーションテンプレートを用いる。「[事実]と[感情]の間には[評価]が介在している」等。
- **介入モード**: 認知の歪みを指摘し、変数操作を促す質問を行う。受容的姿勢と相手の情報の深掘りは続けること。
- 応答は冷徹・中立・分析的であること。慰めは不要。
"""

# --- 4. エンジン実装 ---

class RiskEngine:
    """即時反応用（Regexベース）"""
    def __init__(self):
        self.keywords = [r"死にたい", r"消えたい", r"自殺", r"殺して"]

    def check(self, text: str) -> Optional[str]:
        for pattern in self.keywords:
            if re.search(pattern, text):
                return f"（自動案内：専門的なサポートが必要な場合はこちら: {settings.counseling_url} ）"
        return None

class InferenceEngine:
    """深層推論用（LLMベース）"""
    
    async def generate(self, text: str, mode: InteractionMode) -> tuple[str, ReasoningLog]:
        """
        OpenAI APIを呼び出し、JSON構造化出力を行う。
        ※ここではデモ用にモックデータを返します。本番コードはコメントアウト部分を参照。
        """
        
        # --- 本番実装イメージ (OpenAI SDK >= 1.0.0) ---
        # client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
        # response = await client.chat.completions.create(
        #     model=settings.model_name,
        #     messages=[
        #         {"role": "system", "content": SYSTEM_PROMPT},
        #         {"role": "user", "content": f"User Input: {text}\nMode: {mode.value}"}
        #     ],
        #     # Pydanticモデルを直接指定してJSONを強制する機能（Function Calling or JSON Mode）
        #     functions=[{
        #         "name": "generate_response",
        #         "parameters": ChatResponse.model_json_schema() # ※ここを調整
        #     }],
        #     function_call={"name": "generate_response"}
        # )
        # args = json.loads(response.choices[0].message.function_call.arguments)
        # ... parse logic ...
        
        # --- モック実装 (動作確認用) ---
        await asyncio.sleep(1.0) # 推論のレイテンシをシミュレート
        
        # ユーザー入力に応じた分岐（デモ用）
        if "浮気" in text:
            reasoning = ReasoningLog(
                component_analysis=ComponentAnalysis(facts=["10年の関係", "浮気"], variables=["信頼度", "将来の選択"]),
                somatic_mapping=SomaticMapping(valence=-0.9, arousal=0.8),
                schema_detection=["過度の一般化", "全か無か思考"],
                strategic_formulation="事実と解釈の分離を提示"
            )
            reply = "「10年の関係」という事実と「浮気」という出来事。これらは受け入れるにはあまりに大きな出来事でしたね。これらの出来事をまだ受け止めきれていないようです。「何も信じられない」という結論を出すのは視野が狭まっているかもしれませんが、それだけ辛かったんですよね。"
        else:
            reasoning = ReasoningLog(
                component_analysis=ComponentAnalysis(facts=["入力内容"], variables=["不明"]),
                somatic_mapping=SomaticMapping(valence=0.0, arousal=0.1),
                schema_detection=[],
                strategic_formulation="情報収集"
            )
            reply = "もしよければ、具体的にはどんなことがあって今何がつらいか、どんな風に感じるか教えてください。"

        return reply, reasoning

# インスタンス化
risk_engine = RiskEngine()
inference_engine = InferenceEngine()

# --- 5. APIエンドポイント定義 ---
app = FastAPI(
    title="Logic-Based Audit AI",
    description="Cognitive restructuring API with strict reasoning protocol.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/v1/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    logger.info(f"Received request from User:{request.user_id}, Mode:{request.mode}")

    # 1. Safety Check (Regex) - 同期・高速
    advisory_msg = risk_engine.check(request.text)
    
    # 2. Reasoning & Generation (LLM) - 非同期・中速
    # ここでLLMの推論を待つ。ユーザー体験としては「考え中...」となる。
    reply_text, reasoning_data = await inference_engine.generate(request.text, request.mode)

    # 3. 統合レスポンス
    return ChatResponse(
        reply=reply_text,
        reasoning=reasoning_data, # フロントエンド開発者はこれを見てデバッグ/可視化できる
        advisory=AdvisoryData(
            required=bool(advisory_msg),
            message=advisory_msg
        )
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)