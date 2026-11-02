#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
python_bin=${STUDIOHUB_BUILD_PYTHON:-python3}
"$python_bin" -m PyInstaller --noconfirm --console --name StudioHubEngine --paths "$project_dir" --paths "$project_dir/vendor" --add-data "$project_dir/web:web" --add-data "$project_dir/examples:examples" --add-data "$project_dir/reportflow/dist:reportflow/dist" --add-data "$project_dir/riconcilia/dist:riconcilia/dist" --add-data "$project_dir/vendor/PYPDF_LICENSE.txt:." --distpath build/engine --workpath build/work --specpath build server.py
mkdir -p release/macos
"$python_bin" scripts/assemble_macos.py build/engine/StudioHubEngine release/macos/StudioHub.app
codesign --force --deep --sign - release/macos/StudioHub.app
/usr/bin/ditto -c -k --sequesterRsrc --keepParent release/macos/StudioHub.app release/macos/StudioHub_MAC_AppleSilicon.zip
