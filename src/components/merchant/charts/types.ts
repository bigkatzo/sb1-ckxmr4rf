export interface SalesChartProps {
  data: Array<{
    date: string;
    amount: number;
  }>;
}

export interface ProductDistributionChartProps {
  data: Array<{
    name: string;
    value: number;
    solAmount: number;
  }>;
}

export interface ProductQuantityChartProps {
  data: Array<{
    name: string;
    quantity: number;
  }>;
}

export interface ProductSolChartProps {
  data: Array<{
    name: string;
    solAmount: number;
  }>;
}

export interface ProductTableProps {
  data: Array<{
    rank: number;
    name: string;
    quantity: number;
    solAmount: number;
    collection?: string;
  }>;
} 