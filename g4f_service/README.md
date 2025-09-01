# G4F Service

A Python service that provides HTTP and CLI interfaces for the g4f (GPT4Free) library, enabling Node.js applications to interact with various AI providers.

## Features

- HTTP REST API for g4f integration
- CLI interface for command-line usage
- Provider health monitoring and status checking
- Error handling and retry logic
- Comprehensive test suite
- Support for multiple AI providers through g4f

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install the package (optional):
```bash
pip install -e .
```

## Usage

### HTTP Server

Start the HTTP server:
```bash
python http_server.py --host localhost --port 5001
```

Or using the installed command:
```bash
g4f-server --host localhost --port 5001
```

#### API Endpoints

- `GET /health` - Health check
- `GET /providers` - Get available providers
- `POST /providers/{provider_name}/test` - Test specific provider
- `POST /chat` - Send message to AI provider

#### Example API Usage

Get available providers:
```bash
curl http://localhost:5001/providers
```

Send a chat message:
```bash
curl -X POST http://localhost:5001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "provider": "bing"}'
```

### CLI Interface

Use the CLI interface directly:
```bash
python cli_interface.py providers
python cli_interface.py test bing
python cli_interface.py chat "Hello, how are you?" --provider bing
```

Or using the installed command:
```bash
g4f-cli providers
g4f-cli test bing
g4f-cli chat "Hello, how are you?" --provider bing
```

## API Reference

### Chat Request Format
```json
{
  "message": "Your message here",
  "provider": "bing",
  "model": "gpt-3.5-turbo"
}
```

### Chat Response Format
```json
{
  "success": true,
  "response": {
    "success": true,
    "message": "AI response here",
    "provider": "bing",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### Provider Information Format
```json
{
  "id": "bing",
  "name": "Provider.Bing",
  "status": "available",
  "last_checked": "2024-01-01T12:00:00.000Z",
  "model": null
}
```

## Supported Providers

The service supports the following g4f providers:
- Bing
- ChatgptAi
- FreeGpt
- Liaobots
- You
- Yqcloud

## Error Handling

The service includes comprehensive error handling for:
- Provider unavailability
- Rate limiting
- Network connectivity issues
- Invalid requests
- G4F library errors

## Testing

Run the test suite:
```bash
python -m pytest test_g4f_wrapper.py -v
python -m pytest test_http_server.py -v
```

Or run all tests:
```bash
python -m pytest -v
```

## Configuration

### Environment Variables

- `G4F_SERVICE_HOST` - Server host (default: localhost)
- `G4F_SERVICE_PORT` - Server port (default: 5001)
- `G4F_SERVICE_DEBUG` - Enable debug mode (default: false)

### Provider Cache

The service caches provider status for 5 minutes to improve performance. This can be configured by modifying the `cache_ttl` parameter in the `G4FWrapper` class.

## Integration with Node.js

The service is designed to be used by Node.js applications. Here's an example of how to integrate it:

```javascript
const axios = require('axios');

class G4FClient {
  constructor(baseURL = 'http://localhost:5001') {
    this.baseURL = baseURL;
  }

  async getProviders() {
    const response = await axios.get(`${this.baseURL}/providers`);
    return response.data;
  }

  async sendMessage(message, provider = null, model = 'gpt-3.5-turbo') {
    const response = await axios.post(`${this.baseURL}/chat`, {
      message,
      provider,
      model
    });
    return response.data;
  }

  async testProvider(provider) {
    const response = await axios.post(`${this.baseURL}/providers/${provider}/test`);
    return response.data;
  }
}

module.exports = G4FClient;
```

## Troubleshooting

### Common Issues

1. **G4F library not installed**: Install with `pip install g4f`
2. **Provider unavailable**: Try a different provider or check provider status
3. **Rate limiting**: Wait before retrying or use a different provider
4. **Connection errors**: Check network connectivity and g4f service status

### Logging

The service uses Python's logging module. Set the log level using:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Development

### Project Structure
```
g4f_service/
├── g4f_wrapper.py      # Core g4f wrapper functionality
├── http_server.py      # HTTP server implementation
├── cli_interface.py    # CLI interface
├── test_g4f_wrapper.py # Unit tests for wrapper
├── test_http_server.py # Unit tests for HTTP server
├── requirements.txt    # Python dependencies
├── setup.py           # Package setup
└── README.md          # This file
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License.