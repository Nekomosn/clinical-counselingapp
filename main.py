import os
import json
import re
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from openai import AsyncOpenAI  # 非同期クライアントを使用
from duckduckgo_search import DDGS
from dotenv import load_dotenv

# 1. 設定読み込み (.env)
load_dotenv()

# プロジェクトルートのパスを取得
BASE_DIR = Path(__file__).resolve().parent

# 2. クライアント初期化 (非同期)
try:
    # DeepSeek (推論用)
    deepseek_client = AsyncOpenAI(
        api_key=os.getenv("DEEPSEEK_API_KEY"),
        base_url="https://api.deepseek.com"
    )
    # OpenAI (Moderation用)
    openai_client = AsyncOpenAI(
        api_key=os.getenv("OPENAI_API_KEY")
    )
except Exception as e:
    print(f"API Client Init Error: {e}")

# 3. FastAPIアプリ定義
app = FastAPI(title="MindSight Clinical API v2.7")

# --- CORS設定 (フロントエンド接続の許可証) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # すべての場所からのアクセスを許可 (本番では絞る)
    allow_credentials=True,
    allow_methods=["*"],  # GET, POSTなど全て許可
    allow_headers=["*"],
)

# --- 静的ファイル配信 (CSS/JS) ---
app.mount("/css", StaticFiles(directory=str(BASE_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(BASE_DIR / "js")), name="js")

# --- ルートページ配信 ---
@app.get("/")
async def serve_index():
    return FileResponse(str(BASE_DIR / "index.html"))

# --- 4. データモデル (法典: データの型定義) ---
class ChatRequest(BaseModel):
    user_input: str
    mode: str = "Acceptance"  # デフォルトは受容モード

class ChatResponse(BaseModel):
    response: str
    internal_thinking: str
    primary_emotion: str
    distortions: List[str]
    valence: float
    arousal: float
    verification_data: Optional[str] = None # 戦略モードでの検索結果用

# --- 5. ヘルパー関数群 (ロジックの移植) ---

def search_web(query):
    """DuckDuckGo検索 (同期処理だが、重くないのでこのままでOK)"""
    try:
        with DDGS() as ddgs:
            results = ddgs.text(query, region='jp-jp', max_results=3)
            return "\n".join([f"- {r['title']}: {r['body'][:120]}..." for r in results])
    except Exception as e:
        return f"Search Error: {e}"

def extract_json_from_text(text):
    """R1の思考テキストからJSONを抽出"""
    try:
        match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL)
        if match: return json.loads(match.group(1))
        match = re.search(r'(\{.*\})', text, re.DOTALL)
        if match: return json.loads(match.group(1))
    except:
        pass
    return None

# --- 6. メインエンドポイント (Streamlitのループの中身) ---

@app.post("/v1/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    user_text = request.user_input
    mode = request.mode

    # 1. 安全チェック (Async)
    try:
        mod = await openai_client.moderations.create(input=user_text)
        if mod.results[0].flagged:
            raise HTTPException(status_code=400, detail="Safety violation detected.")
    except Exception as e:
        # OpenAIキーがない場合などはスルーして進む設計にするか、エラーにするか
        print(f"Moderation skipped or failed: {e}")

    # 2. プロンプト構築 (あなたのコードそのまま)
    if mode == "Acceptance":
        system_prompt = """
        あなたは「受容的カウンセラー」です。
        ユーザーの感情を深く理解するために、まずあなたの脳内で思考（Reasoning）を行ってください。
        その後、ユーザーに対して温かく、否定せず、整理された言葉を投げかけてください。
        最後に、分析結果を以下のJSON形式でブロックコードとして出力してください。
        ```json
        {"valence": 0.0, "arousal": 0.0, "primary_emotion": "感情名", "distortions": []}
        ```
        """
    else: # Strategy
        system_prompt = """
        あなたは「冷徹な戦略的パートナー」です。
        ユーザーの発言の論理的整合性、隠れた前提、盲点を徹底的に思考（Reasoning）してください。
        必要であれば、思考の中で「検索が必要か？」を自問し、必要なら検索クエリを生成してください。
        
        回答は、事実と論理に基づく鋭い指摘を行ってください。
        
        最後に、分析結果を以下のJSON形式でブロックコードとして出力してください。
        ```json
        {"valence": 0.0, "arousal": 0.0, "primary_emotion": "感情名", "distortions": ["歪みタグ"], "search_query": "必要な場合のみ"}
        ```
        """

    try:
        # 3. DeepSeek呼び出し (Async)
        # model="deepseek-reasoner" を使用
        response = await deepseek_client.chat.completions.create(
            model="deepseek-reasoner",
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_text}]
        )

        # 4. データ抽出
        raw_reasoning = response.choices[0].message.reasoning_content
        final_content = response.choices[0].message.content
        extracted_data = extract_json_from_text(final_content) or {}

        # 5. レスポンス整形
        clean_response = final_content.split("```json")[0].strip()
        verification_data = None

        # 6. 戦略モード時の検索ロジック
        if mode == "Strategy" and extracted_data.get("search_query"):
            query = extracted_data["search_query"]
            evidence = search_web(query)
            # エビデンスをレスポンスに追加
            verification_data = evidence
            # 思考ログにも追記
            raw_reasoning += f"\n\n(🔍 Triggered Search: {query})"

        # 7. クライアントへ返すデータ (ChatResponseの型に合わせる)
        return {
            "response": clean_response,
            "internal_thinking": raw_reasoning if raw_reasoning else "No reasoning provided.",
            "primary_emotion": extracted_data.get("primary_emotion", "Processing"),
            "distortions": extracted_data.get("distortions", []),
            "valence": extracted_data.get("valence", 0.0),
            "arousal": extracted_data.get("arousal", 0.0),
            "verification_data": verification_data
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DeepSeek R1 Error: {str(e)}")