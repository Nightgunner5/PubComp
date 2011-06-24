all: pubcomp.smx

.PHONY: version.inc install

pubcomp.smx: pubcomp.sp sourcemod/addons/sourcemod/scripting/spcomp config.inc version.inc
	./sourcemod/addons/sourcemod/scripting/spcomp pubcomp.sp

version.inc:
	bash -c 'echo "#define PLUGIN_VERSION \"`git describe 2>/dev/null || echo 0.1`-`git log -1 --format=format:%H`\""' > version.inc

sourcemod/addons/sourcemod/scripting/spcomp: sourcemod.tar.gz
	mkdir -p sourcemod
	which pv > /dev/null && pv sourcemod.tar.gz | tar mxz -C sourcemod || tar mxzf sourcemod.tar.gz -C sourcemod

sourcemod.tar.gz:
	wget http://www.gsptalk.com/mirror/sourcemod/sourcemod-1.3.7-linux.tar.gz -O sourcemod.tar.gz

install: pubcomp.smx
	if test -d /mnt/hgfs/hlserver; then cp pubcomp.smx /mnt/hgfs/hlserver/orangebox/tf/addons/sourcemod/plugins; fi
	if test -d ../tfds; then cp pubcomp.smx ../tfds/orangebox/tf/addons/sourcemod/plugins; fi
	python ReloadPubcomp.py || true
