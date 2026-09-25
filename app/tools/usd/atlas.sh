#!/bin/bash
# Section atlas wrapper: atlas.sh NAME POSE AXIS VALUE U0 U1 V0 V1 [px/mm] -> /tmp/duo/usd/atlas-NAME.png
here=$(cd "$(dirname "$0")" && pwd)
name=$1; shift
uv run -q --python 3.12 --with usd-core --with pillow python "$here/usd_atlas.py" "$@" 2>&1 | grep -v -E "ArchWarn|Function:|File:|Line:" | grep -v '^wrote'
v=$(python3 -c "print(f'{float(\"$3\"):g}')")
mv "/tmp/duo/usd/atlas-$1-$2$v.png" "/tmp/duo/usd/atlas-$name.png" && echo "-> /tmp/duo/usd/atlas-$name.png"
