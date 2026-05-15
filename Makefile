# LinkedIn Automation Makefile

.PHONY: help install setup api scheduler dashboard frontend test clean-data connect replies feed first-message followups

help:
	@echo "Available commands:"
	@echo "  make install         - Install dependencies for backend and frontend"
	@echo "  make setup           - Run LinkedIn login setup"
	@echo "  make api             - Start the Backend API (Port 3001)"
	@echo "  make scheduler       - Start the background task scheduler"
	@echo "  make dashboard       - Start the legacy dashboard server (Port 3000)"
	@echo "  make frontend        - Start the Next.js frontend (Port 4000)"
	@echo "  make test            - Run all tests"
	@echo "  make clean-data      - Remove session and database files (Caution!)"
	@echo ""
	@echo "Tasks:"
	@echo "  make connect         - Run connection request workflow"
	@echo "  make replies         - Run reply check and response workflow"
	@echo "  make feed            - Run feed commenting workflow"
	@echo "  make first-message   - Run first message workflow"
	@echo "  make followups       - Run followup marking workflow"

install:
	npm install
	npx playwright install chromium
	cd frontend && npm install

setup:
	node src/index.js setup

api:
	npm run api

scheduler:
	node src/index.js schedule

dashboard:
	node src/index.js dashboard

frontend:
	cd frontend && npm run dev

test:
	npm run test

clean-data:
	rm -f data/session.json data/claude-session.json database/cue-os.sqlite*

# Individual Task Proxies
connect:
	node src/index.js connect

replies:
	node src/index.js replies

feed:
	node src/index.js feed

first-message:
	node src/index.js first-message

followups:
	node src/index.js followups
