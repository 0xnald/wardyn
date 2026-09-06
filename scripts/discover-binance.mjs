import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client({ name: 'wardyn-discovery', version: '0.1.0' });
const timer = setTimeout(() => { console.error('Binance MCP discovery timed out.'); process.exit(1); }, 20000);
try {
  await client.connect(new StreamableHTTPClientTransport(new URL('https://agent.binance.com/mcp/agentic')));
  const result = await client.listTools();
  console.log(JSON.stringify(result.tools.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : 'MCP discovery failed');
  process.exitCode = 1;
} finally { clearTimeout(timer); await client.close(); }
