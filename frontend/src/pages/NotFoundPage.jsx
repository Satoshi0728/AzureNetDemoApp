import { Link } from "react-router-dom";
import { ToolPage } from "../components/ToolPage.jsx";

export const NotFoundPage = () => {
  return (
    <ToolPage
      title="ページが見つかりません"
      description="指定されたパスに対応するページは存在しません。URL をご確認のうえ、トップページへ戻ってください。"
      eyebrow="404"
      actions={
        <div className="tool-button-bar">
          <Link className="btn btn-sm btn-ghost" to="/tools/ip-fqdn">
            ユーティリティを見る
          </Link>
        </div>
      }
    >
      <article className="tool-card">
        <p className="tool-main-text">お探しのページは削除されたか、URL が変更された可能性があります。</p>
      </article>
    </ToolPage>
  );
};
