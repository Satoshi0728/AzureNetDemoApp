# King of Ofuro's Azure Network Demo Application
(English/Japanese)
Welcome to the King of Ofuro's Azure Network Demo Application! This project provides a comprehensive set of tools and APIs to help you understand how your requests are processed through various Azure networking services such as Azure Front Door, Application Gateway, etc.

King of Ofuro の Azure ネットワークデモアプリケーションへようこそ！このプロジェクトは、Azure Front Door や Application Gateway などの Azure ネットワーキングサービスを通じてリクエストがどのように処理されるかを理解するための包括的なツールと API を提供します。

## 実行環境の条件 / Prerequisites
以下を事前にインストールしてください。Windows 環境を想定していますが、macOS/Linux でも同様の手順で導入可能です。

- docker (Docker Desktop 推奨)
URL: <https://docs.docker.com/desktop/setup/install/windows-install/>
- PowerShell 7 以降 ( deploy-appservice.ps1 用)
URL: <https://learn.microsoft.com/ja-jp/powershell/scripting/install/installing-powershell?view=powershell-7.3>
- Azure CLI
URL: <https://learn.microsoft.com/ja-jp/cli/azure/install-azure-cli-windows?tabs=azure-cli>
- Azure PowerShell モジュール
URL: <https://learn.microsoft.com/ja-jp/powershell/azure/install-az-ps?view=azps-9.6.0>


## クイックスタート
簡単に動作確認できます。

### A. Docker Compose で起動（開発向け・おすすめ）

```bash
docker compose up --build
```

- App: <http://localhost:5173>

※ 停止する場合は `docker compose down -v`

### B. Node.js で直接起動（ローカル開発向け）

```bash
cd backend && npm install && npm run dev
```

別ターミナルで:

```bash
cd frontend && npm install && npm run dev
```

- UI: <http://localhost:5173>
- API: <http://localhost:8080/api/v1/hello>

## デプロイ (Azure App Service)

### スクリプト概要 (`deploy-script/deploy-appservice.ps1`)

- サブスクリプション選択 (CLI/PowerShell 既定も候補化) と RG 自動作成。
- ACR: 指定 RG 内を探索し、1件なら自動選択、複数なら選択プロンプト、0件なら新規作成。admin 有効化・資格情報取得まで実行。
- コンテナイメージ: 既定タグは JST の `yyyyMMddHHmm`。リポジトリが既に ACR にある場合は常に新しい JST タイムスタンプタグでプッシュ。
- App Service プラン: 既存 Linux プランがあれば選択プロンプト。Health チェックは B1 以上で `/api/healthz` を設定（F1/D1 はスキップ）。
- Application Insights: 既存を選択 or 新規作成。ログは Log Analytics Workspace に紐付け。
- Log Analytics Workspace: 名前未指定時、対象 RG 内の既存を再利用（1件自動、複数は選択）。無い場合のみ新規作成。

### 主なパラメータ

| パラメータ | 既定値 / 例 | 説明 |
| --- | --- | --- |
| `-UniqueName` | (必須) | リソース名のベース。RG/ACR/Plan/WebApp/AppInsights などに反映。英数字とハイフンに正規化されます。 |
| `-SubscriptionId` | (省略可) | 省略時は CLI/PowerShell 既定と手入力を案内。 |
| `-Location` | `japaneast` | リソース作成リージョン。既存プランを選んだ場合はそのロケーションに合わせます。 |
| `-WebAppResourceGroupName` | `rg-<unique>` | Web App・プランの RG。 |
| `-AcrName` / `-AcrResourceGroupName` | 自動生成 / `WebAppResourceGroupName` | ACR 名と RG。未指定時は RG を探索して再利用、無ければ作成。 |
| `-AppServicePlanName` / `-AppServicePlanSku` | `<unique>-plan` / `F1` | 既存プランを選択可能。F1/D1 はヘルスチェック非対応。 |
| `-WebAppName` | `<unique>-webapp` | デプロイ先 Web App 名。 |
| `-ImageName` | `<unique>-app` | ACR リポジトリ名。既存リポジトリがあれば新しい JST タイムスタンプタグでプッシュ。 |
| `-ImageTag` | `yyyyMMddHHmm` (JST) | 既定タグ。リポジトリが存在する場合は新しい JST タイムスタンプに上書き。 |
| `-DockerContext` / `-Dockerfile` | ルート / `Dockerfile` | ビルド元。`-SkipDockerBuild`/`-SkipDockerPush` で制御可能。 |
| `-DockerPlatform` | `linux/amd64` | `docker build --platform` に渡します。 |
| `-EnvironmentVariables` | `NODE_ENV=production`, `WEBSITES_ENABLE_APP_SERVICE_STORAGE=true` | Web App のアプリ設定。`WEBSITES_PORT` は自動で `TargetPort` を設定。ストレージ共有の既定値は true（詳細は後述）。 |
| `-HealthCheckPath` / `-EnableHealthCheck` | `/api/healthz` / `$true` | B1 以上のみ適用。無効化は `-EnableHealthCheck:$false`。 |
| `-EnableAppInsights` / `-UseExistingAppInsights` | `$true` / `$false` | 既存 App Insights 選択可。無効化は `-EnableAppInsights:$false`。 |
| `-DisableIpMasking` | `$false` | Application Insights の IP マスキングを無効化。既定では収集しないことを推奨。使用時は下記の警告とドキュメントを確認。 |
| `-LogAnalyticsWorkspaceName` / `-LogAnalyticsWorkspaceResourceGroupName` | 未指定なら探索 / `WebAppResourceGroupName` | 未指定時は RG 内の既存 Workspace を優先利用。無い場合だけ新規作成。 |

### 実行例

```powershell
./deploy-script/deploy-appservice.ps1 `
  -UniqueName "kof-sample" `
  -Location "japanwest" `
  -WebAppResourceGroupName "rg-kof-sample" `
  -AppServicePlanSku "B1" `
  -DisableIpMasking 1
```

> **Health check:** Free/Shared (F1/D1) プランではスキップされ、B1 以上では `/api/healthz` を自動設定します。既定パスを変えたい場合は `-HealthCheckPath "/your/path"` を指定してください。OFF にしたい場合は `-EnableHealthCheck:$false` を明示してください。
> **Image タグ:** `-ImageTag` 未指定でも JST タイムスタンプ (`yyyyMMddHHmm`) でビルド・プッシュされます。既存リポジトリがある場合は毎回新しいタイムスタンプタグになります。
> **App Insights:** `-EnableAppInsights:$false` で無効化できます。既存を選ぶ場合は `-UseExistingAppInsights:$true` を指定してください。
> **Log Analytics Workspace:** `-LogAnalyticsWorkspaceName` 未指定時、対象 RG 内の既存 Workspace を優先利用します。無い場合だけ新規作成されます。

#### IP マスキング (Application Insights)

- `-DisableIpMasking` を `$true` にすると、Application Insights で IP マスキングを無効化します（既定はマスキング有効）。
- 既定では、IP アドレスを収集しないことが推奨されます。無効化する場合はコンプライアンスや現地規制への適合を必ず確認してください。

> **警告**
>
> 既定では、IP アドレスを収集しないことをお勧めします。 この動作をオーバーライドする場合は、収集することがコンプライアンス要件や現地の規制に違反していないかどうかを確認してください。
>
> 個人データ処理の詳細については、個人データのガイダンスに関するページをご覧ください。

詳細: <https://learn.microsoft.com/ja-jp/azure/azure-monitor/app/ip-collection?tabs=portal>

#### ストレージ共有 (WEBSITES_ENABLE_APP_SERVICE_STORAGE)

- 既定で `WEBSITES_ENABLE_APP_SERVICE_STORAGE=true` を付与しています（Linux カスタムコンテナの場合、/home をスケールインスタンス間で共有する設定）。
- Azure 公式リファレンス: <https://learn.microsoft.com/ja-jp/azure/app-service/reference-app-settings?tabs=kudu%2Cdotnet#custom-containers>
  - 設定が無い場合、Linux は既定で /home が共有されます。共有を無効化するには `false` を明示します。
  - Windows コンテナでは `true` が既定で、`c:\home` が共有されます。
- FAQ（カスタムコンテナ）: <https://learn.microsoft.com/en-us/troubleshoot/azure/app-service/faqs-app-service-linux#custom-containers>
  - `false` または未設定の場合、/home は共有されず、書き込んだファイルは再起動後に保持されません。
  - 共有を有効にするには `true` を明示し、無効化したい場合は `false` を明示してください。

デプロイ完了後は Web App の URL にアクセスし、`/tools/ip-fqdn`・`/tools/http-headers` などのルートが Express + React で再現されていることを確認してください。`/api/v1/forbidden` は 403 を返すため、監視ツールの設定時には注意してください。

## 主なルート / API

| 種別 | パス | 説明 |
| --- | --- | --- |
| ページ | `/` | ページ系・API 系の全エンドポイントを検索・コピーできるカタログを備えています。 |
| ページ | `/tools/hello` | バックエンドの `/api/v1/hello` から取得した Hello メッセージと生成時刻を表示する動作確認ページです。 |
| ページ | `/tools/ip-fqdn` | クライアント IP と判定に使われたヘッダー種別、Host ヘッダーとフル URL を 1 画面で確認できます。IP・Host のコピー、最新値の再取得、直近 5 件までの履歴表示を備え、プロキシ配下での経路調査や DNS/Host 調査に役立ちます。 |
| ページ | `/tools/http-headers` | 受信した全 HTTP ヘッダーを整理し、Azure Front Door / Application Gateway 固有ヘッダーなど重要な項目をハイライトします。最新値の取得、全ヘッダーの一括コピー、履歴保存・コピー、行ごとの展開表示が可能で、WAF・ロードバランサ経由時の付加ヘッダー検証に最適です。 |
| API | `/api/healthz` | `ok: true` と現在時刻、固定バージョンを返す単純なヘルスチェック API。App Service / コンテナの起動確認、監視設定、ロードバランサのヘルスプローブにそのまま利用できます。認証不要で軽量なため外形監視に向きます。 |
| API | `/api/v1/hello` | タイトル・メッセージ・生成時刻を含む挨拶 JSON を返します。UI 側の `/tools/hello` で利用され、API 到達性や JSON シリアライズ確認の最小ケースとして使えます。サンプルながらバックエンド経由のデータ取得パターンを示します。 |
| API | `/api/v1/client-ip` | クライアント IP と判定ソースを返すスタンドアロン API。`X-Forwarded-For`／`X-Client-IP`／`X-Original-Forwarded-For` を優先的に参照し、なければソケットのアドレスを利用します。結果はタイムスタンプ付きで、経路上のどのヘッダーが有効かを機械的に確認できます。 |
| API | `/api/v1/headers` | 受信した全ヘッダーを配列で返し、重要フラグ付きで並び替え済み。空文字や配列も正規化して返すため、CDN/WAF/リバースプロキシが付与する特殊ヘッダーの有無をプログラムから検証できます。タイムスタンプ付きで、UI 側の履歴機能とも連動します。 |
| API | `/api/v1/ip-fqdn` | クライアント IP 情報と Host/URL 情報をまとめて返却する複合 API。IP 側は判定ソース付き、FQDN 側は Host ヘッダーと再構成したフル URL を含みます。1 リクエストで経路・名前解決・リバースプロキシ設定の食い違いを把握する用途に適します。 |
| API | `/api/v1/fqdn` | Host ヘッダーとプロトコル・パスを組み立てた URL を返す軽量 API。FQDN がどのように見えているかを個別に確認したいときに使用し、IP 判定が不要なケースでの疎通チェックを簡素化します。 |
| API | `/api/v1/endpoints` | ランディングのカタログ表示で用いるエンドポイントメタデータを返します。ページ系・API 系を区別し、説明文や HTTP メソッド、ステータスコードを含むため、フロントエンドはこの JSON を元に一覧を自動生成できます。 |
| API | `/api/v1/forbidden` | JSON 形式の 403 Forbidden を返し、パス情報と生成時刻を含みます。ゲートウェイ設定や認可エラー時のハンドリングを再現するためのテスト用エンドポイントで、監視ツールやデモで意図的な失敗応答を確認する用途に向きます。 |

## アーキテクチャ概要

- **フロントエンド (`frontend/`)**
  - Vite + React 18 + React Router でユーティリティをページ化し、`EndpointCatalogSection` で `/api/v1/endpoints` 由来のカタログを描画。
  - `useApiResource` を全ツールで共通利用し、`/api/v1/hello` / `/api/v1/ip-fqdn` / `/api/v1/headers` などのレスポンスをハンドリング。テーブルや履歴表示は各ページ固有の UI コンポーネントで提供。
- **バックエンド (`backend/`)**
  - Express 4 + Helmet + Compression + CORS。`routes/api.js` が `/api/healthz` を返し、`routes/v1/index.js` が v1 配下の各 API を提供。
  - `services/requestInsights.js` が IP 判定・ヘッダー正規化・FQDN 生成・403 ペイロードを担当し、`services/catalog.js` が SPA 用カタログメタデータを提供。
  - `/api/v1/forbidden` は明示的に 403 を返し、ゲートウェイ/認可エラーの再現テストに使用。
- **コンテナ構成 / デプロイ**
  - ルートのマルチステージ `Dockerfile` でフロントエンドをビルドし、成果物を `backend/public/client` に同梱した Node 実行イメージを生成。
  - Azure App Service のコンテナ デプロイを主ターゲットとし、`deploy-script/deploy-appservice.ps1` で ACR ビルド〜 Web App 反映を自動化。

## ディレクトリ構成

```text
.
├── backend/
│   ├── src/
│   │   ├── config/env.js          # 環境変数と CORS 設定
│   │   ├── routes/
│   │   │   ├── api.js             # /api ルートエントリ
│   │   │   └── v1/index.js        # /api/v1 エンドポイント集合
│   │   └── services/
│   │       ├── requestInsights.js # IP / ヘッダー / FQDN ロジック
│   │       └── catalog.js         # エンドポイント一覧
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/            # UI コンポーネント
│   │   ├── pages/                 # ルーティング単位のページ
│   │   ├── hooks/                 # カスタムフック群
│   │   ├── constants/contentDefaults.js # Azure リソース機能の静的データ
│   │   └── utils/clipboard.js     # クリップボード util
│   └── package.json
├── deploy-script/deploy-appservice.ps1  # Azure App Service デプロイ自動化スクリプト
├── monitoring/
│   └── ping-endpoints.js          # ヘルスチェック + 403 検証スクリプト
├── Dockerfile                     # マルチステージビルド
├── docker-compose.yml             # ローカル開発用
└── README.md
```

## ローカル開発

### Node.js で直接起動

1. ルートに `.env` は不要ですが、CORS を調整する場合は `backend/.env` を作成し `CORS_ORIGINS` を指定します。
2. Terminal 1 (`backend/`):

  ```bash
  cd backend
  npm install
  npm run dev
  ```

  サーバーは `<http://localhost:8080>` で待ち受けます。
3. Terminal 2 (`frontend/`):

  ```bash
  cd frontend
  npm install
  npm run dev
  ```

  Vite の開発サーバーは `<http://localhost:5173>`。`vite.config.js` のプロキシ設定により `/api` 呼び出しはバックエンドへ転送されます。

### Docker Compose　(Recommended)

```bash
docker compose up --build
```

- UI（フロントエンド/Vite）: <http://localhost:5173>
- API（バックエンド/Express）: <http://localhost:8080/api/v1/hello> などユーティリティ系 API

> **注意:** Docker Compose は「開発サーバー構成（2コンテナ）」です。
> バックエンド（8080）は API 提供が主で、`/tools/*` の UI は基本的にフロントエンド（5173）からアクセスしてください。
> 基本的にはルートのマルチステージ Dockerfile のようにフロント成果物をバックエンドに同梱する構成（本番用 1 コンテナ）で起動してください。

停止する場合は `docker compose down -v`。

## 公開時の注意（セキュリティ/プライバシー）

このアプリは「ネットワーク経路やヘッダー挙動の可視化」を目的にしているため、公開運用では次を必ず意識してください。

- `/api/v1/headers` は、環境によって `Cookie` / `Authorization` などの情報が混ざる可能性があります。公開する場合はアクセス制御（認証・IP 制限・非公開化）や返却値のマスキングを検討してください。
- アクセスログ（User-Agent / IP など）や Application Insights への送信は、**個人情報（PII）扱い**になることがあります。収集範囲・保持期間・マスキング（IP 収集の扱い）を確認してください。

## テスト

- **バックエンド (Jest + Supertest)**

  ```bash
  cd backend
  npm test            # 一度実行
  npm run test:watch  # 監視モード
  ```

  `/api/v1/hello` や `/api/v1/client-ip` など主要ユーティリティ API のレスポンスを検証します。`/api/v1/forbidden` が 403 を返すことも自動チェック対象です。

- **フロントエンド (Vitest + Testing Library)**

  ```bash
  cd frontend
  npm test            # CI 向け一括実行
  npm run test:watch  # 開発向け
  ```

  React Router 化されたユーティリティページ (`IpFqdnPage` / `HelloPage` / `HeadersPage`) が API データを正しく描画するかを確認します。
  IP/FQDN ページではリロードによる履歴追加ロジックもカバーするテストを追加済みです。

## CORS 設定

- 本番環境では `CORS_ORIGINS` の設定を推奨します（未設定だと全 Origin 許可になり得ます）。
- 形式は **カンマ区切り**です（空白は無視されます）。

### ローカルや汎用デプロイの例

```bash
# backend/.env
CORS_ORIGINS=https://your-domain.example,https://www.your-domain.example
```

### Azure App Service（コンテナ）での設定方法

- `.env` を配置する必要はありません。App Service の「アプリ設定」に `CORS_ORIGINS` を追加すれば問題ないです。（コードは `process.env.CORS_ORIGINS` を参照）。
- ポータル: App Service → 設定 → 環境変数 → アプリ設定 → 追加。名前 `CORS_ORIGINS`、値 `https://hoge.webapps.net`（必要に応じてカンマ区切りで複数）→ 保存。
- CLI:

```bash
az webapp config appsettings set \
  --resource-group <リソースグループ名> \
  --name <アプリ名> \
  --settings CORS_ORIGINS=https://hoge.webapps.net
```

> CORS は「ブラウザの別オリジン JavaScript から API を呼べるか」を制御します。本番では意図したオリジンだけを列挙してください。

## 稼働監視の例

軽量な動作監視として、`monitoring/ping-endpoints.js` は指定したベース URL に対して `/api/healthz` と `/api/v1/forbidden` を順番にリクエストし、HTTP ステータスを検証します。Azure App Service へのデプロイ後に CI/CD から実行することで、ヘルスチェックと 403 レスポンスが継続して提供されているかを素早く把握できます。

```bash
node monitoring/ping-endpoints.js --base https://kof-sample.azurewebsites.net
```

`BASE_URL` 環境変数でも指定可能です。タイムアウトは既定 10 秒で、`--timeout 15000` などで調整できます。

## コールドスタート (Azure App Service)

Free/Shared プランではアイドル状態からのリクエストでコールドスタートが発生し、応答までに時間がかかる場合があります。
`Always On` が利用できる Basic (B1) 以上へのアップグレードを検討してください。

