# Load Testing for Open Assistant

## Usage

### set env variables

```bash
cp .env.example .env

# edit variables

# exports variables
export $(grep -v '^#' .env | xargs)
```

### Chat with assistant

```bash
k6 run 01-chat/test.js
```

### Function calling

```bash
k6 run 02-function/test.js
```
