# Countdown multiplayer backend.
#
# Assumes an active AWS_PROFILE is already exported in your shell; the AWS CLI
# reads it from the environment. Local targets (build, test, clean) do not need
# it. Override the deploy settings on the command line, e.g.
#
#   make deploy STACK_NAME=countdown-backend ENVIRONMENT=dev AWS_REGION=eu-west-1

STACK_NAME   ?= countdown-backend
ENVIRONMENT  ?= dev
AWS_REGION   ?= eu-west-1

# Extra CloudFormation parameter overrides, e.g.
#   make deploy PARAM_OVERRIDES="RoomTtlSeconds=3600 LogLevel=DEBUG"
PARAM_OVERRIDES ?=

BUILD_DIR := build
ARTIFACT  := $(BUILD_DIR)/function.zip

AWS := aws --region $(AWS_REGION)
# Resolved lazily, only in targets that touch AWS — keeps `make test` offline.
ACCOUNT_ID       = $(shell aws sts get-caller-identity --query Account --output text)
ARTIFACT_BUCKET ?= countdown-backend-artifacts-$(ACCOUNT_ID)-$(AWS_REGION)

.PHONY: build validate deploy outputs websocket-url delete test clean check-profile

## build: package the Lambda into build/function.zip
build:
	@rm -rf $(BUILD_DIR)
	@mkdir -p $(BUILD_DIR)/package
	@cp -R src/. $(BUILD_DIR)/package/
	@# Production dependencies, if any are declared (boto3 ships with the runtime).
	@if grep -qvE '^[[:space:]]*(#.*)?$$' requirements.txt 2>/dev/null; then \
		pip install -r requirements.txt -t $(BUILD_DIR)/package --quiet ; \
	fi
	@find $(BUILD_DIR)/package -name '__pycache__' -type d -prune -exec rm -rf {} +
	@cd $(BUILD_DIR)/package && zip -qr ../function.zip .
	@echo "Built $(ARTIFACT)"

## validate: validate the CloudFormation template with the active profile
validate: check-profile
	@$(AWS) cloudformation validate-template --template-body file://template.yaml >/dev/null
	@echo "template.yaml is valid"

## deploy: package, upload, and deploy the stack
deploy: check-profile build
	@echo "==> Deploying $(STACK_NAME) to $(AWS_REGION) (env: $(ENVIRONMENT))"
	@BUCKET=$(ARTIFACT_BUCKET); \
	$(AWS) s3api head-bucket --bucket $$BUCKET 2>/dev/null || $(AWS) s3 mb s3://$$BUCKET --region $(AWS_REGION); \
	KEY=lambda/$$(shasum -a 256 $(ARTIFACT) | cut -c1-16).zip; \
	$(AWS) s3 cp $(ARTIFACT) s3://$$BUCKET/$$KEY; \
	$(AWS) cloudformation deploy \
		--stack-name $(STACK_NAME) \
		--template-file template.yaml \
		--capabilities CAPABILITY_IAM \
		--no-fail-on-empty-changeset \
		--parameter-overrides Environment=$(ENVIRONMENT) LambdaS3Bucket=$$BUCKET LambdaS3Key=$$KEY $(PARAM_OVERRIDES)
	@echo "==> Done. WebSocket URL:"
	@$(MAKE) -s websocket-url

## outputs: print all stack outputs
outputs: check-profile
	@$(AWS) cloudformation describe-stacks --stack-name $(STACK_NAME) \
		--query 'Stacks[0].Outputs' --output table

## websocket-url: print only the WebSocket URL (safe for shell capture)
websocket-url: check-profile
	@$(AWS) cloudformation describe-stacks --stack-name $(STACK_NAME) \
		--query "Stacks[0].Outputs[?OutputKey=='WebSocketUrl'].OutputValue" --output text

## delete: delete the stack (prints what will go first)
delete: check-profile
	@echo "==> Deleting stack '$(STACK_NAME)' in region '$(AWS_REGION)'"
	@$(AWS) cloudformation delete-stack --stack-name $(STACK_NAME)
	@$(AWS) cloudformation wait stack-delete-complete --stack-name $(STACK_NAME)
	@echo "==> Deleted."

## test: run the unit tests (no AWS access required)
test:
	python3 -m pytest

## clean: remove build artifacts and caches
clean:
	@rm -rf $(BUILD_DIR) .pytest_cache
	@find . -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
	@echo "Cleaned."

# Fail clearly if AWS_PROFILE is not set — but only for targets that need AWS.
check-profile:
	@test -n "$(AWS_PROFILE)" || { \
		echo "ERROR: AWS_PROFILE must be set (export AWS_PROFILE=your-profile)"; \
		exit 1; \
	}
