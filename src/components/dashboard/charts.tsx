"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const pieConfig = {
  connections: { label: "Connections" },
  ChatGPT: { label: "ChatGPT", color: "var(--chart-1)" },
  Claude: { label: "Claude", color: "var(--chart-2)" },
  Gemini: { label: "Gemini", color: "var(--chart-3)" },
  Copilot: { label: "Copilot", color: "var(--chart-4)" },
  Perplexity: { label: "Perplexity", color: "var(--chart-5)" },
  Cursor: { label: "Cursor", color: "var(--chart-1)" },
  Groq: { label: "Groq", color: "var(--chart-3)" },
} satisfies ChartConfig;

const barConfig = {
  connections: { label: "Connections", color: "var(--chart-1)" },
} satisfies ChartConfig;

const trendConfig = {
  connections: { label: "Connections", color: "var(--chart-1)" },
} satisfies ChartConfig;

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ToolUsageChart({
  data,
}: {
  data: { tool: string; connections: number }[];
}) {
  const pieData = data.map((d) => ({
    name: d.tool,
    connections: d.connections,
    fill: undefined as string | undefined,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Usage by tool</CardTitle>
          <CardDescription>
            Connection volume split across recognised AI domains
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={pieConfig} className="mx-auto aspect-square max-h-64">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={pieData}
                dataKey="connections"
                nameKey="name"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connections by tool</CardTitle>
          <CardDescription>Same split as a bar comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barConfig} className="h-64 w-full">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="tool"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={36} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="connections"
                fill="var(--color-connections)"
                radius={4}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export function TrendChart({
  data,
}: {
  data: { day: string; connectionCount: number }[];
}) {
  const chartData = data.map((d) => ({
    day: typeof d.day === "string" ? d.day.slice(5) : String(d.day).slice(5),
    connections: d.connectionCount,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI-tool connections — last {data.length} days</CardTitle>
        <CardDescription>Domain-level handshake count over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={trendConfig} className="h-64 w-full">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
              interval="preserveStartEnd"
            />
            <YAxis tickLine={false} axisLine={false} fontSize={11} width={36} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="connections"
              stroke="var(--color-connections)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
