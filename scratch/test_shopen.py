import ctypes
from ctypes import wintypes
from pathlib import Path

ole32 = ctypes.windll.ole32
shell32 = ctypes.windll.shell32

ole32.CoInitialize.argtypes = [ctypes.c_void_p]
ole32.CoInitialize.restype = ctypes.HRESULT

shell32.ILCreateFromPathW.argtypes = [wintypes.LPCWSTR]
shell32.ILCreateFromPathW.restype = ctypes.c_void_p

shell32.ILFree.argtypes = [ctypes.c_void_p]
shell32.ILFree.restype = None

shell32.SHOpenFolderAndSelectItems.argtypes = [
    ctypes.c_void_p,
    wintypes.UINT,
    ctypes.c_void_p,
    wintypes.DWORD,
]
shell32.SHOpenFolderAndSelectItems.restype = ctypes.HRESULT

# Create test files with spaces and parentheses just like Haenara's PC
test_dir = Path.home() / "Downloads" / "Merlin_Z_Core (4)"
test_dir.mkdir(parents=True, exist_ok=True)
test_file1 = test_dir / "안내_README.txt"
test_file1.write_text("테스트 안내 파일", encoding="utf-8")

test_file2 = Path.home() / "Downloads" / "파일접수 상세내역_30216052_20261030122102_sundream78.xlsx"
test_file2.write_text("테스트 엑셀 파일", encoding="utf-8")

hr_init = ole32.CoInitialize(None)
print(f"CoInitialize hr: {hr_init:#x}")

for tf in (test_file1, test_file2):
    pidl = shell32.ILCreateFromPathW(str(tf.resolve()))
    print(f"Target: {tf} -> pidl={pidl}")
    if pidl:
        hr = shell32.SHOpenFolderAndSelectItems(pidl, 0, None, 0)
        print(f"SHOpenFolderAndSelectItems hr: {hr:#x}")
        shell32.ILFree(pidl)
