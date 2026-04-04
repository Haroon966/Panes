import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env') });
