# -*- coding: utf-8 -*-
import subprocess

key = r'C:\Users\chichi\.ssh\id_ai_master'
subprocess.run(
    [
        'scp',
        '-i',
        key,
        '-o',
        'StrictHostKeyChecking=no',
        'universal_z_core/os_agent/merlin_z_core_os.py',
        'sun-multi@100.88.230.16:C:/Users/sun-multi/merlin_z_core_os.py',
    ],
    check=True,
)
remote_py = (
    "import pathlib, sys; sys.path.insert(0, 'C:/Users/sun-multi'); "
    "import merlin_z_core_os as m; "
    "print('Downloads:', m.get_explorer_folder_title_candidates(pathlib.Path.home()/'Downloads')); "
    "print('Documents:', m.get_explorer_folder_title_candidates(pathlib.Path.home()/'Documents')); "
    "print('Desktop:', m.get_explorer_folder_title_candidates(pathlib.Path.home()/'Desktop'))"
)
res = subprocess.run(
    [
        'ssh',
        '-i',
        key,
        '-o',
        'StrictHostKeyChecking=no',
        'sun-multi@100.88.230.16',
        f'python -X utf8 -c "{remote_py}"',
    ],
    capture_output=True,
    text=True,
    encoding='utf-8',
)
print('Remote Node 2 output:\n' + res.stdout + res.stderr)
