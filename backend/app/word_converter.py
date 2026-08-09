from pathlib import Path


class WordConversionError(RuntimeError):
    pass


def convert_with_word(source_path: Path, output_path: Path, file_format: int) -> None:
    try:
        import pythoncom
        from win32com.client import DispatchEx
    except ImportError as error:
        raise WordConversionError("Microsoft Word 자동화를 위해 pywin32 설치가 필요합니다.") from error

    word = None
    document = None
    pythoncom.CoInitialize()
    try:
        word = DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        document = word.Documents.Open(str(source_path.resolve()))
        document.SaveAs2(str(output_path.resolve()), FileFormat=file_format)
    except Exception as error:
        raise WordConversionError(f"Word 파일 변환에 실패했습니다: {error}") from error
    finally:
        if document is not None:
            document.Close(False)
        if word is not None:
            word.Quit()
        pythoncom.CoUninitialize()


def convert_doc_to_docx(source_path: Path, output_path: Path) -> None:
    convert_with_word(source_path, output_path, 16)


def convert_docx_to_doc(source_path: Path, output_path: Path) -> None:
    convert_with_word(source_path, output_path, 0)


def convert_doc_to_pdf(source_path: Path, output_path: Path) -> None:
    convert_with_word(source_path, output_path, 17)
