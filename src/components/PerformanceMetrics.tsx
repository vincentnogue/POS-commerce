import { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';

interface ModulePerformance {
  module: string;
  icon: React.ReactNode;
  usage: number;
  trend: number;
  performance: number;
  activeUsers: number;
  color: string;
  data: Array<{ date: string; value: number; efficiency: number }>;
}

const MODULES_DATA: ModulePerformance[] = [
  {
    module: 'Point of Sale',
    icon: '🛒',
    usage: 94,
    trend: 12,
    performance: 98,
    activeUsers: 1240,
    color: '#2E8C66',
    data: [
      { date: 'Mon', value: 240, efficiency: 92 },
      { date: 'Tue', value: 321, efficiency: 95 },
      { date: 'Wed', value: 289, efficiency: 91 },
      { date: 'Thu', value: 412, efficiency: 96 },
      { date: 'Fri', value: 534, efficiency: 98 },
      { date: 'Sat', value: 621, efficiency: 97 },
      { date: 'Sun', value: 189, efficiency: 93 },
    ]
  },
  {
    module: 'Inventory',
    icon: '📦',
    usage: 87,
    trend: 8,
    performance: 95,
    activeUsers: 856,
    color: '#14B594',
    data: [
      { date: 'Mon', value: 120, efficiency: 88 },
      { date: 'Tue', value: 145, efficiency: 91 },
      { date: 'Wed', value: 156, efficiency: 92 },
      { date: 'Thu', value: 178, efficiency: 94 },
      { date: 'Fri', value: 198, efficiency: 96 },
      { date: 'Sat', value: 176, efficiency: 93 },
      { date: 'Sun', value: 134, efficiency: 89 },
    ]
  },
  {
    module: 'Reports',
    icon: '📊',
    usage: 76,
    trend: 15,
    performance: 92,
    activeUsers: 923,
    color: '#F96F22',
    data: [
      { date: 'Mon', value: 89, efficiency: 85 },
      { date: 'Tue', value: 112, efficiency: 88 },
      { date: 'Wed', value: 134, efficiency: 91 },
      { date: 'Thu', value: 156, efficiency: 93 },
      { date: 'Fri', value: 189, efficiency: 95 },
      { date: 'Sat', value: 167, efficiency: 92 },
      { date: 'Sun', value: 145, efficiency: 90 },
    ]
  },
  {
    module: 'Payments',
    icon: '💳',
    usage: 99,
    trend: 22,
    performance: 99,
    activeUsers: 1567,
    color: '#2E63DD',
    data: [
      { date: 'Mon', value: 450, efficiency: 98 },
      { date: 'Tue', value: 523, efficiency: 99 },
      { date: 'Wed', value: 612, efficiency: 99 },
      { date: 'Thu', value: 734, efficiency: 99 },
      { date: 'Fri', value: 856, efficiency: 99 },
      { date: 'Sat', value: 923, efficiency: 99 },
      { date: 'Sun', value: 456, efficiency: 98 },
    ]
  },
];

const radarData = MODULES_DATA.map(m => ({
  module: m.module.split(' ')[0],
  usage: m.usage,
  performance: m.performance,
  trend: Math.min(m.trend * 5, 100),
}));

export function PerformanceMetrics() {
  const topModule = useMemo(() => 
    MODULES_DATA.reduce((prev, current) => 
      prev.usage > current.usage ? prev : current
    ), []
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Module Performance</h3>
        <p className="text-gray-600 dark:text-gray-400">Real-time metrics across your business modules</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {MODULES_DATA.map((module) => (
          <div 
            key={module.module}
            className="bg-gradient-to-br from-white to-gray-50 dark:from-ink-800 dark:to-ink-900 border border-gray-200 dark:border-ink-700 rounded-xl p-4 hover:shadow-lg transition"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{module.icon}</span>
              <div className={`flex items-center gap-1 text-sm font-semibold ${module.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp size={16} />
                {module.trend}%
              </div>
            </div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{module.module}</h4>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{module.usage}%</p>
            <p className="text-xs text-gray-500 mt-2">{module.activeUsers.toLocaleString()} active users</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart - Usage Trends */}
        <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-xl p-6">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Usage Trends</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={MODULES_DATA[0].data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-ink-700" />
              <XAxis dataKey="date" stroke="#6b7280" className="dark:stroke-gray-400" />
              <YAxis stroke="#6b7280" className="dark:stroke-gray-400" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#2E8C66" 
                strokeWidth={2}
                dot={{ fill: '#2E8C66', r: 4 }}
                activeDot={{ r: 6 }}
                name="Point of Sale"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart - Performance Score */}
        <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-xl p-6">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Performance Score</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={MODULES_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-ink-700" />
              <XAxis 
                dataKey="module" 
                angle={-45}
                textAnchor="end"
                height={80}
                stroke="#6b7280" 
                className="dark:stroke-gray-400"
              />
              <YAxis stroke="#6b7280" className="dark:stroke-gray-400" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
              />
              <Bar dataKey="performance" fill="#2E8C66" name="Performance %" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Area Chart - Efficiency */}
        <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-xl p-6">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Efficiency Rate</h4>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={MODULES_DATA[0].data}>
              <defs>
                <linearGradient id="colorEfficiency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E8C66" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#2E8C66" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-ink-700" />
              <XAxis dataKey="date" stroke="#6b7280" className="dark:stroke-gray-400" />
              <YAxis stroke="#6b7280" className="dark:stroke-gray-400" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="efficiency" 
                stroke="#2E8C66" 
                fillOpacity={1} 
                fill="url(#colorEfficiency)" 
                name="Efficiency %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart - Module Comparison */}
        <div className="bg-white dark:bg-ink-800 border border-gray-200 dark:border-ink-700 rounded-xl p-6">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Module Comparison</h4>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" className="dark:stroke-ink-700" />
              <PolarAngleAxis dataKey="module" stroke="#6b7280" className="dark:stroke-gray-400" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#6b7280" className="dark:stroke-gray-400" />
              <Radar name="Usage" dataKey="usage" stroke="#2E8C66" fill="#2E8C66" fillOpacity={0.5} />
              <Radar name="Performance" dataKey="performance" stroke="#14B594" fill="#14B594" fillOpacity={0.3} />
              <Legend />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#f3f4f6'
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6">
        <div className="flex gap-4">
          <Activity className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={24} />
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Performance Insights</h4>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {topModule.module} is your top module with {topModule.usage}% usage and {topModule.trend}% growth. 
              {topModule.performance >= 95 
                ? ' Excellent performance across all metrics.' 
                : ' Consider optimizing for better performance.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
