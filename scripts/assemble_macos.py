"""Assemble a small Finder launcher around the packaged Python engine."""
import plistlib,shutil,sys
from pathlib import Path
engine,app=map(Path,sys.argv[1:])
if app.exists():raise SystemExit('La cartella app esiste già. Scegli un nuovo percorso.')
(app/'Contents/MacOS').mkdir(parents=True);(app/'Contents/Resources').mkdir()
shutil.copytree(engine,app/'Contents/Resources/engine',symlinks=True)
launcher=app/'Contents/MacOS/StudioHub';launcher.write_text('#!/bin/sh\nset -eu\nresources_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../Resources" && pwd)\nexec "$resources_dir/engine/StudioHubEngine" "$@"\n');launcher.chmod(0o755)
with (app/'Contents/Info.plist').open('wb') as f:plistlib.dump({'CFBundleName':'StudioHub','CFBundleDisplayName':'StudioHub Blu notte','CFBundleIdentifier':'it.studiohub.blunotte','CFBundleExecutable':'StudioHub','CFBundlePackageType':'APPL','CFBundleShortVersionString':'0.4.0','LSMinimumSystemVersion':'12.0','LSUIElement':True,'NSHighResolutionCapable':True},f)
