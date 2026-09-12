import React from "react";
import { Upload, X } from "lucide-react";

export function FilePicker(props: {
  accept?: string;
  helperText: string;
  onChange: (file: File | null) => void;
}) {
  const [fileName, setFileName] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function handleFileChange(file: File | null) {
    setFileName(file?.name ?? "");
    props.onChange(file);
  }

  return (
    <div className="file-picker">
      <input
        ref={inputRef}
        type="file"
        accept={props.accept}
        onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
      />
      <button type="button" className="file-trigger" onClick={() => inputRef.current?.click()}>
        <Upload size={17} />
        <span>{fileName || props.helperText}</span>
      </button>
      {fileName && (
        <button
          type="button"
          className="file-clear"
          title="파일 선택 해제"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = "";
            }
            handleFileChange(null);
          }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
