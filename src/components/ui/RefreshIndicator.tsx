import { Loading, LoadingType } from './LoadingStates';

interface RefreshIndicatorProps {
  isRefreshing: boolean;
  message?: string;
}

/**
 * Component that shows a loading indicator when refreshing data
 */
export function RefreshIndicator({ isRefreshing, message = "Refreshing data..." }: RefreshIndicatorProps) {
  if (!isRefreshing) return null;
  
  // Use ACTION type instead of REFRESH since REFRESH is not defined in LoadingType
  return <Loading type={LoadingType.ACTION} text={message} />;
}