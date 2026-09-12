import { Download, FileText } from "lucide-react";

import type { GeneratedMinutes } from "../types";
import { formatBytes } from "../lib/files";

export function ResultPage(props: {
  result: GeneratedMinutes;
  onDownload: () => void;
  onPreview: () => void;
  onBack: () => void;
}) {
  return (
    <section className="workspace result-workspace">
      <div className="panel result-panel">
        <div className="result-copy">
          <span className="result-kicker">생성 완료</span>
          <h2>회의록 파일이 준비되었습니다.</h2>
          <strong className="generated-title">{props.result.title}</strong>
          <p>{props.result.titleMode === "ai" ? "AI가 생성한 제목입니다." : "직접 입력한 제목으로 생성했습니다."}</p>
        </div>

        <button className="file-summary file-summary-button" type="button" onClick={props.onPreview}>
          <FileText size={24} />
          <div>
            <strong>{props.result.filename}</strong>
            <span>{formatBytes(props.result.size)} · {props.result.previewUrl ? "PDF 미리보기" : "파일 미리보기"}</span>
          </div>
        </button>

        {props.result.previewUrl ? (
          <div className="preview-frame">
            <iframe title="회의록 미리보기" src={props.result.previewUrl} />
          </div>
        ) : (
          <p className="preview-empty">미리보기 파일을 만들지 못했습니다. 다운로드로 확인하세요.</p>
        )}

        <div className="result-actions">
          <button className="secondary" type="button" onClick={props.onBack}>
            다시 작성
          </button>
          <button className="primary" type="button" onClick={props.onDownload}>
            <Download size={18} />
            다운로드
          </button>
        </div>
      </div>
    </section>
  );
}

export function GenerationLoading(props: {
  progress: number;
  step: string;
}) {
  return (
    <section className="workspace result-workspace">
      <div className="panel result-panel loading-panel">
        <div className="result-copy">
          <span className="result-kicker">생성 중</span>
          <h2>회의록을 작성하고 있습니다.</h2>
          <p>{props.step}</p>
        </div>

        <div className="progress-block" aria-label="회의록 생성 진행률">
          <div className="progress-header">
            <span>진행률</span>
            <strong>{props.progress}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${props.progress}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
