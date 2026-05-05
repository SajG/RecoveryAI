import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatINR } from "@/lib/format";

type RecoveryIntelligenceData = {
  forecast: {
    baseRealizationRatePct: number;
    forecast30: number;
    forecast60: number;
    forecast90: number;
    totalOutstanding: number;
  };
  partyReliability: Array<{
    key: string;
    label: string;
    committed: number;
    recovered: number;
    realizationPct: number;
    onTimePct: number;
    promiseCount: number;
  }>;
  salespersonReliability: Array<{
    key: string;
    label: string;
    committed: number;
    recovered: number;
    realizationPct: number;
    onTimePct: number;
    promiseCount: number;
  }>;
  dunningFunnel: Array<{
    stage: string;
    count: number;
    amount: number;
  }>;
};

export function RecoveryIntelligenceView({ data }: { data: RecoveryIntelligenceData }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Recovery Intelligence</h2>
        <p className="text-sm text-slate-600">
          Top 3 high-value dashboards: Recovery Forecast, Promise-to-Pay Reliability, and Dunning Funnel.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border border-slate-200/80 ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Realization Rate (90d)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold text-slate-900">{data.forecast.baseRealizationRatePct}%</CardContent>
        </Card>
        <Card className="border border-slate-200/80 ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Forecast 30 Days</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold text-emerald-600">{formatINR(data.forecast.forecast30)}</CardContent>
        </Card>
        <Card className="border border-slate-200/80 ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Forecast 60 Days</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold text-emerald-600">{formatINR(data.forecast.forecast60)}</CardContent>
        </Card>
        <Card className="border border-slate-200/80 ring-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">Forecast 90 Days</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-2xl font-semibold text-emerald-600">{formatINR(data.forecast.forecast90)}</CardContent>
        </Card>
      </section>

      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <CardTitle>Dunning Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="py-2 pr-3 font-medium">Stage</th>
                  <th className="py-2 pr-3 text-right font-medium">Party Count</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.dunningFunnel.map((row) => (
                  <tr key={row.stage} className="border-b border-slate-100 text-slate-700">
                    <td className="py-2 pr-3 font-medium text-slate-900">{row.stage}</td>
                    <td className="py-2 pr-3 text-right">{row.count}</td>
                    <td className="py-2 pr-3 text-right">{formatINR(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border border-slate-200/80 ring-0">
          <CardHeader>
            <CardTitle>Promise-to-Pay Reliability by Salesperson</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-[620px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-3 font-medium">Salesperson</th>
                    <th className="py-2 pr-3 text-right font-medium">Promises</th>
                    <th className="py-2 pr-3 text-right font-medium">Committed</th>
                    <th className="py-2 pr-3 text-right font-medium">Recovered</th>
                    <th className="py-2 pr-3 text-right font-medium">Realization %</th>
                    <th className="py-2 pr-3 text-right font-medium">On-time %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.salespersonReliability.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100 text-slate-700">
                      <td className="py-2 pr-3 font-medium text-slate-900">{row.label}</td>
                      <td className="py-2 pr-3 text-right">{row.promiseCount}</td>
                      <td className="py-2 pr-3 text-right">{formatINR(row.committed)}</td>
                      <td className="py-2 pr-3 text-right">{formatINR(row.recovered)}</td>
                      <td className="py-2 pr-3 text-right">{row.realizationPct}%</td>
                      <td className="py-2 pr-3 text-right">{row.onTimePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 ring-0">
          <CardHeader>
            <CardTitle>Top Party Promise Reliability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-[620px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="py-2 pr-3 font-medium">Party</th>
                    <th className="py-2 pr-3 text-right font-medium">Promises</th>
                    <th className="py-2 pr-3 text-right font-medium">Committed</th>
                    <th className="py-2 pr-3 text-right font-medium">Recovered</th>
                    <th className="py-2 pr-3 text-right font-medium">Realization %</th>
                    <th className="py-2 pr-3 text-right font-medium">On-time %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.partyReliability.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100 text-slate-700">
                      <td className="py-2 pr-3 font-medium text-slate-900">{row.label}</td>
                      <td className="py-2 pr-3 text-right">{row.promiseCount}</td>
                      <td className="py-2 pr-3 text-right">{formatINR(row.committed)}</td>
                      <td className="py-2 pr-3 text-right">{formatINR(row.recovered)}</td>
                      <td className="py-2 pr-3 text-right">{row.realizationPct}%</td>
                      <td className="py-2 pr-3 text-right">{row.onTimePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
