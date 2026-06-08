# Email Checker Test Suite

This directory contains comprehensive tests for the Email Checker application, designed to validate accuracy and stability without hitting the real network.

## Test Structure

### Unit Tests
- `format.unit.test.js` - Email format validation (regex correctness)
- `dns.unit.test.js` - DNS MX resolution with mocks
- `smtp.unit.test.js` - SMTP probing with mocks
- `meta.unit.test.js` - Disposable/blacklisted/role-based detection

### Integration Tests
- `emailChecker.integration.test.js` - Full API testing with Supertest
- `frontend.smoke.test.js` - Frontend component testing with Jest DOM

### Fixtures
- `fixtures/emails.json` - Test email dataset
- `fixtures/emails.csv` - CSV format test data

### Mocks
- `__mocks__/dns.mock.js` - Deterministic DNS responses
- `__mocks__/smtp.mock.js` - Deterministic SMTP responses

## Running Tests

### Basic Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Environment
Tests run with the following environment variables:
- `NODE_ENV=test`
- `USE_MOCKS=true` - Forces mock services
- `MONGO_URI=mongodb://localhost:27017/email-checker-test`
- `PORT=5001` - Different port for test server

## Mock Services

### DNS Mock (`__mocks__/dns.mock.js`)
Deterministic MX record responses:
- `gmail.com` → has MX: true
- `yahoo.com` → has MX: true  
- `example.com` → has MX: false
- `test-catchall.com` → has MX: true
- `mailinator.com` → has MX: true
- `bad-domain.test` → has MX: true
- `corp.com` → has MX: true

### SMTP Mock (`__mocks__/smtp.mock.js`)
Deterministic SMTP responses:
- `valid@gmail.com` → deliverable: true
- `noone@yahoo.com` → deliverable: false, reason: "smtp_reject"
- `slow@corp.com` → deliverable: false, reason: "timeout"
- `*@test-catchall.com` → deliverable: true, catchAll: true
- Default → deliverable: false, reason: "unknown"

## Test Fixtures

### Email Dataset (`fixtures/emails.json`)
```json
[
  "valid@gmail.com",           // Valid email
  "noone@yahoo.com",           // SMTP reject
  "user@example.com",          // No MX records
  "fake@mailinator.com",       // Disposable
  "admin@corp.com",            // Role-based
  "abc@test-catchall.com",     // Catch-all domain
  "slow@corp.com",             // Timeout
  "bad@bad-domain.test",       // Blacklisted
  "BadFormat",                 // Invalid format
  "Another.BadFormat@",       // Invalid format
  "duplicate@gmail.com",       // Duplicate (appears twice)
  "duplicate@gmail.com"
]
```

## Quality Gates

### Accuracy Threshold
Tests include a 90% accuracy gate on the deterministic fixture:
- Expected outcomes are predefined for each test email
- Accuracy is calculated as `correct / total >= 0.9`
- Test fails if accuracy drops below threshold

### Error Handling
- Individual email errors don't crash the batch
- Each error is mapped to a per-email `status` and `reason`
- API never throws 500 due to single bad email

## Adding New Tests

### Adding More Fixture Emails
1. Add emails to `fixtures/emails.json` and `fixtures/emails.csv`
2. Update expected outcomes in integration tests
3. Add corresponding mock responses if needed

### Adding New Mock Responses
1. Update `__mocks__/dns.mock.js` for DNS responses
2. Update `__mocks__/smtp.mock.js` for SMTP responses
3. Ensure deterministic behavior (no randomness)

### Adding New Test Cases
1. Create new test file in `tests/` directory
2. Follow naming convention: `*.test.js`
3. Use descriptive test names
4. Include both positive and negative test cases

## Manual Testing Against Real Network

To temporarily test against real network (for manual experiments):

1. Set `USE_MOCKS=false` in environment
2. Run specific test: `npm test -- --testNamePattern="Specific Test"`
3. **Warning**: This will make real network calls and may be slow

## Test Coverage

The test suite covers:
- ✅ Email format validation (regex)
- ✅ DNS MX resolution
- ✅ SMTP probing (full mode)
- ✅ Safe mode behavior
- ✅ Disposable email detection
- ✅ Blacklist detection
- ✅ Role-based email detection
- ✅ Catch-all detection
- ✅ Error handling
- ✅ De-duplication
- ✅ API endpoints
- ✅ Frontend components
- ✅ CSV generation

## Troubleshooting

### Common Issues

1. **Tests failing with network errors**
   - Ensure `USE_MOCKS=true` is set
   - Check mock implementations

2. **MongoDB connection errors**
   - Tests use separate test database
   - Ensure MongoDB is running locally

3. **Port conflicts**
   - Tests use port 5001 to avoid conflicts
   - Check if port is available

4. **Timeout errors**
   - Increase Jest timeout in `jest.config.js`
   - Check for infinite loops in tests

### Debug Mode
Run tests with verbose output:
```bash
npm test -- --verbose
```

### Coverage Reports
Coverage reports are generated in `coverage/` directory:
- HTML report: `coverage/lcov-report/index.html`
- LCOV report: `coverage/lcov.info`
