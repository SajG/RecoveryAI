import Link from "next/link";
import { ArrowUpRight, PhoneCall } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/format";
import type { CriticalParty } from "@/types/dashboard";

type CriticalPartiesTableProps = {
  parties: CriticalParty[];
  loading?: boolean;
};

export function CriticalPartiesTable({ parties, loading = false }: CriticalPartiesTableProps) {
  if (loading) {
    return (
      <Card className="border border-slate-200/80 ring-0">
        <CardHeader>
          <Skeleton className="h-5 w-64" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200/80 ring-0">
      <CardHeader>
        <CardTitle>Top Critical Parties</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party</TableHead>
              <TableHead>Salesperson</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Days Overdue</TableHead>
              <TableHead className="text-right">Quick Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parties.map((party) => (
              <TableRow key={party.id}>
                <TableCell>
                  <Link href={`/parties/${party.id}`} className="inline-flex items-center gap-1 font-medium text-slate-900 hover:underline">
                    {party.name}
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                </TableCell>
                <TableCell className="text-slate-600">{party.salespersonName}</TableCell>
                <TableCell className="text-right font-semibold text-red-600">{formatINR(party.outstanding)}</TableCell>
                <TableCell className="text-right text-slate-700">{party.daysOverdue} days</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <PhoneCall className="h-3.5 w-3.5" />
                    Follow up
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
