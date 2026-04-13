# Diagnostic Fixes — Evidence Notes

## OdsHistoryChart.tsx

Change: data filtering only (odsNumber=0 instead of all ODS mixed).
No visual changes to the chart component — same LineChart, same colors, same layout.
The only difference is the data source: pre-computed global score vs corrupted average of 18 rows.

## useTrend.ts

Same: data filtering fix. No UI changes.

## api.ts

Storage mechanism change (memory -> sessionStorage). No visual impact.
