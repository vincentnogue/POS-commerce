import { Activity, Zap, Shield, TrendingUp } from 'lucide-react';

interface IntegrationStatsProps {
  totalIntegrations: number;
  connectedIntegrations: number;
  integrationLimit: number;
  activeConnections: number;
}

export function IntegrationStats({ 
  totalIntegrations, 
  connectedIntegrations, 
  integrationLimit,
  activeConnections 
}: IntegrationStatsProps) {
  const usagePercentage = Math.round((connectedIntegrations / integrationLimit) * 100);
  const availableSlots = integrationLimit - connectedIntegrations;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {/* Total Available */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 hover:shadow-lg transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">Total Available</span>
          <Zap className="text-blue-600 dark:text-blue-400" size={18} />
        </div>
        <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{totalIntegrations}</p>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">integrations available</p>
      </div>

      {/* Connected */}
      <div className="bg-gradient-to-br from-green-50 to-green-50 dark:from-green-900/20 dark:to-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-4 hover:shadow-lg transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-green-900 dark:text-green-200">Connected</span>
          <Activity className="text-green-600 dark:text-green-400" size={18} />
        </div>
        <p className="text-3xl font-bold text-green-900 dark:text-green-100">{connectedIntegrations}</p>
        <p className="text-xs text-green-700 dark:text-green-300 mt-1">active connections</p>
      </div>

      {/* Capacity */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-50 dark:from-purple-900/20 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl p-4 hover:shadow-lg transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">Capacity</span>
          <Shield className="text-purple-600 dark:text-purple-400" size={18} />
        </div>
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-purple-700 dark:text-purple-300">{availableSlots} available</span>
            <span className="text-xs font-semibold text-purple-900 dark:text-purple-100">{usagePercentage}%</span>
          </div>
          <div className="w-full bg-purple-200 dark:bg-purple-900/30 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-purple-500 to-purple-600 h-full transition-all"
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Growth */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-50 dark:from-orange-900/20 dark:to-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4 hover:shadow-lg transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-orange-900 dark:text-orange-200">Growth</span>
          <TrendingUp className="text-orange-600 dark:text-orange-400" size={18} />
        </div>
        <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">+{activeConnections}</p>
        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">this month</p>
      </div>
    </div>
  );
}
