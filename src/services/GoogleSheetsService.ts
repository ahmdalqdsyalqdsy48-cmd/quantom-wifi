export interface DashboardStats {
  users_active: number;
  users_total: number;
  agents_active: number;
  agents_total: number;
  managers_active: number;
  managers_total: number;
  networks_count: number;
  categories_count: number;
  available_cards: number;
  sold_cards: number;
  total_sales_points: number;
  agent_earnings: number;
  system_profit: number;
  financial_operations: number;
  pending_deposits: number;
  pending_settlements: number;
  approved_requests: number;
  rejected_requests: number;
}

export interface ActivityLogEntry {
  id: string;
  user: string;
  details: string;
  network: string;
  value: string | number;
  date: string;
  type: string;
  status?: string;
}

class GoogleSheetsService {
  private baseUrl = '/api';

  async getStats(): Promise<Record<string, any>> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`);
      if (!response.ok) {
        // If not OK, just return empty object without throwing if it's a 500
        // This avoids noisy console errors for unconfigured sheets
        return {};
      }
      return await response.json();
    } catch (error) {
      // Only log actual network errors or parsing errors
      console.warn('GoogleSheetsService.getStats: Could not fetch stats (likely not configured or offline)');
      return {};
    }
  }

  async updateStats(stats: Partial<DashboardStats>): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stats),
      });
      return response.ok;
    } catch (error) {
      console.error('GoogleSheetsService.updateStats error:', error);
      return false;
    }
  }

  async appendLog(log: ActivityLogEntry): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
      return response.ok;
    } catch (error) {
      console.error('GoogleSheetsService.appendLog error:', error);
      return false;
    }
  }

  async syncData(type: string, data: any[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data }),
      });
      return response.ok;
    } catch (error) {
      console.error(`GoogleSheetsService.syncData (${type}) error:`, error);
      return false;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
