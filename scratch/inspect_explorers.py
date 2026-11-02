import sys
sys.path.insert(0, "universal_z_core/os_agent")
import merlin_z_core_os as zos

wins = zos.find_explorer_windows_on_default_desktop([])
print(f"Open Explorer windows: {len(wins)}")
for w in wins:
    print(" ", w)
