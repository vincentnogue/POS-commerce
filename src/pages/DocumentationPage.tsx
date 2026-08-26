import { useState } from 'react';
import { Code, Copy, ExternalLink, BookOpen, Search, ChevronDown } from 'lucide-react';

export function DocumentationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      subsections: [
        {
          id: 'auth',
          title: 'Authentication',
          content: `All API requests require authentication using a Bearer token (JWT).

Get your API key from Settings → API Keys.

Example:
\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.pos.liafrik.com/v1/sales
\`\`\`

The token is valid for 30 days. Rotate keys regularly for security.`,
        },
        {
          id: 'base-url',
          title: 'Base URL',
          content: `All API requests go to: https://api.pos.liafrik.com/v1

Example endpoints:
- https://api.pos.liafrik.com/v1/sales
- https://api.pos.liafrik.com/v1/products
- https://api.pos.liafrik.com/v1/integrations
- https://api.pos.liafrik.com/v1/webhooks`,
        },
      ],
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      subsections: [
        {
          id: 'sales-api',
          title: 'Sales API',
          content: `List, create, and manage sales transactions.

GET /sales
List all sales for tenant

Query Parameters:
- limit: number (default: 100, max: 1000)
- offset: number (default: 0)
- status: string (all, completed, pending, failed)
- date_from: ISO date
- date_to: ISO date

Example:
\`\`\`bash
curl -X GET https://api.pos.liafrik.com/v1/sales?limit=50&status=completed \\
  -H "Authorization: Bearer YOUR_API_KEY"
\`\`\`

Response:
\`\`\`json
{
  "data": [
    {
      "id": "sale_123",
      "amount": 99.99,
      "currency": "USD",
      "status": "completed",
      "payment_method": "card",
      "created_at": "2026-08-26T12:34:56Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1250
  }
}
\`\`\``,
        },
        {
          id: 'products-api',
          title: 'Products API',
          content: `Manage inventory and products.

GET /products
List all products

POST /products
Create new product

Request body:
\`\`\`json
{
  "name": "Laptop",
  "sku": "LAP-001",
  "price": 1299.99,
  "currency": "USD",
  "quantity": 50,
  "category": "Electronics",
  "description": "High-performance laptop"
}
\`\`\`

GET /products/:id
Get specific product

PATCH /products/:id
Update product

DELETE /products/:id
Delete product`,
        },
        {
          id: 'invoices-api',
          title: 'Invoices API',
          content: `Create and manage invoices.

POST /invoices
Create invoice

Request:
\`\`\`json
{
  "customer_id": "cust_123",
  "items": [
    {
      "product_id": "prod_456",
      "quantity": 2,
      "unit_price": 49.99
    }
  ],
  "discount": 10,
  "notes": "Thank you for your business"
}
\`\`\`

GET /invoices/:id
Get invoice details

GET /invoices/:id/pdf
Download invoice as PDF

POST /invoices/:id/send
Send invoice via email`,
        },
        {
          id: 'payments-api',
          title: 'Payments API',
          content: `Process payments through integrated PSPs.

POST /payments/initialize
Initialize payment

Request:
\`\`\`json
{
  "provider": "stripe",
  "amount": 99.99,
  "currency": "USD",
  "description": "Order #12345",
  "metadata": {
    "order_id": "12345",
    "customer_email": "user@example.com"
  }
}
\`\`\`

Response:
\`\`\`json
{
  "payment_url": "https://pay.stripe.com/...",
  "reference": "posflow_1724165100_abc123",
  "transaction_id": "txn_abc123"
}
\`\`\`

GET /payments/:reference
Check payment status

POST /payments/:reference/refund
Refund payment`,
        },
        {
          id: 'integrations-api',
          title: 'Integrations API',
          content: `Manage marketplace integrations.

GET /integrations
List connected integrations

POST /integrations/connect
Connect new integration

Request:
\`\`\`json
{
  "provider": "stripe",
  "credentials": {
    "api_key": "sk_live_...",
    "webhook_secret": "whsec_..."
  }
}
\`\`\`

POST /integrations/:id/test
Test integration connection

DELETE /integrations/:id
Disconnect integration

GET /integrations/:id/logs
View sync logs for integration`,
        },
      ],
    },
    {
      id: 'webhooks',
      title: 'Webhooks',
      subsections: [
        {
          id: 'webhook-events',
          title: 'Webhook Events',
          content: `Subscribe to real-time events.

Event Types:
- payment.succeeded
- payment.failed
- invoice.created
- invoice.sent
- product.updated
- inventory.low
- order.completed
- sync.completed
- integration.error

Example Setup:
\`\`\`bash
curl -X POST https://api.pos.liafrik.com/v1/webhooks \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://yourapp.com/webhook",
    "events": ["payment.succeeded", "invoice.created"],
    "active": true
  }'
\`\`\`

Webhook Payload:
\`\`\`json
{
  "event": "payment.succeeded",
  "timestamp": "2026-08-26T12:34:56Z",
  "data": {
    "payment_id": "pay_123",
    "amount": 99.99,
    "currency": "USD",
    "status": "completed"
  }
}
\`\`\``,
        },
      ],
    },
    {
      id: 'errors',
      title: 'Error Handling',
      subsections: [
        {
          id: 'error-codes',
          title: 'Error Codes',
          content: `Common error responses:

400 Bad Request
- Invalid parameters
- Malformed request body

401 Unauthorized
- Missing or invalid API key
- Token expired

403 Forbidden
- Insufficient permissions
- Resource access denied

404 Not Found
- Resource does not exist

429 Too Many Requests
- Rate limit exceeded
- Retry after: X seconds

500 Internal Server Error
- Server error
- Contact support

Example Error Response:
\`\`\`json
{
  "error": "invalid_request",
  "message": "Missing required field: amount",
  "code": 400
}
\`\`\``,
        },
      ],
    },
  ];

  const filteredSections = sections.map((section) => ({
    ...section,
    subsections: section.subsections.filter(
      (sub) =>
        sub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.content.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-950 via-brand-950 to-ink-900">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-ink-800/50 bg-ink-950/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-8 h-8 text-flow-400" />
            <h1 className="text-3xl font-bold text-white">API Documentation</h1>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-ink-900/50 border border-ink-800 text-white placeholder-ink-500 focus:outline-none focus:border-flow-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-8">
          {filteredSections.map((section) => (
            <div key={section.id}>
              <button
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                className="w-full flex items-center gap-3 px-6 py-4 rounded-lg bg-ink-900/50 border border-ink-800 hover:border-flow-500/50 transition text-left"
              >
                <ChevronDown
                  className={`w-5 h-5 text-flow-400 transition-transform ${expandedSection === section.id ? 'rotate-180' : ''}`}
                />
                <h2 className="text-xl font-bold text-white flex-1">{section.title}</h2>
              </button>

              {expandedSection === section.id && (
                <div className="mt-4 space-y-4">
                  {section.subsections.map((subsection) => (
                    <div
                      key={subsection.id}
                      className="px-6 py-4 rounded-lg bg-ink-900/30 border border-ink-800/50"
                    >
                      <h3 className="text-lg font-bold text-white mb-3">{subsection.title}</h3>

                      {/* Content with code blocks */}
                      <div className="text-ink-300 space-y-4 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                        {subsection.content.split('```').map((block, i) => {
                          if (i % 2 === 0) {
                            return (
                              <div key={i} className="text-ink-300 font-normal">
                                {block}
                              </div>
                            );
                          } else {
                            const language = block.split('\n')[0];
                            const code = block.split('\n').slice(1).join('\n');

                            return (
                              <div key={i} className="relative">
                                <div className="absolute top-2 right-2 flex items-center gap-2">
                                  <span className="text-xs text-ink-500">{language || 'code'}</span>
                                  <button
                                    onClick={() => copyToClipboard(code, `${subsection.id}-${i}`)}
                                    className="p-1.5 rounded bg-ink-800 hover:bg-ink-700 text-ink-400 hover:text-flow-400 transition"
                                    title="Copy code"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                                <pre className="bg-ink-950/50 border border-ink-800 rounded px-4 py-3 pr-20 overflow-x-auto text-flow-300">
                                  {code}
                                </pre>
                                {copiedCode === `${subsection.id}-${i}` && (
                                  <div className="absolute top-10 right-2 text-xs text-green-400 animate-pulse">
                                    Copied!
                                  </div>
                                )}
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-ink-800/50 bg-ink-950/50 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-ink-400">
          <p>Need help? <a href="/help" className="text-flow-400 hover:text-flow-300">Visit Help Center</a> or <a href="mailto:support@pos.liafrik.com" className="text-flow-400 hover:text-flow-300">contact support</a></p>
        </div>
      </div>
    </div>
  );
}
