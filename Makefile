include config.mk

HOMEDIR = $(shell pwd)
SSHCMD = ssh $(USER)@$(SERVER)
PRIVSSHCMD = ssh $(PRIVUSER)@$(SERVER)
PROJECTNAME = franz-list
APPDIR = /opt/$(PROJECTNAME)

pushall: update-remote
	git push origin main

run:
	node start-service.js

sync:
	rsync -a $(HOMEDIR)/ $(USER)@$(SERVER):$(APPDIR) --exclude node_modules/ \
		--exclude stores/ \
	  --omit-dir-times --no-perms
	$(SSHCMD) "cd /opt/$(PROJECTNAME) && npm install"

overwrite-stores:
	rsync -avz $(HOMEDIR)/stores/* $(USER)@$(SERVER):$(APPDIR)/stores/

reset-local-store:
	cp stores/starter-store.json stores/main-store.json

restart-remote:
	$(PRIVSSHCMD) "service $(PROJECTNAME) restart"

start-service:
	$(PRIVSSHCMD) "service $(PROJECTNAME) start"

stop-service:
	$(PRIVSSHCMD) "service $(PROJECTNAME) stop"

update-remote: sync restart-remote

install-service:
	$(PRIVSSHCMD) "cp $(APPDIR)/$(PROJECTNAME).service /etc/systemd/system && \
	systemctl enable $(PROJECTNAME)"

set-up-app-dir:
	$(SSHCMD) "mkdir -p $(APPDIR)"

set-permissions:
	$(SSHCMD) "chmod +x $(APPDIR)/start-service.js"

initial-setup: set-up-app-dir sync set-permissions install-service

check-status:
	$(SSHCMD) "systemctl status $(PROJECTNAME)"

check-log:
	$(SSHCMD) "journalctl -r -u $(PROJECTNAME)" | more

test:
	rm tests/fixtures/test-store-a-working-copy.json
	node tests/basic-tests.js
