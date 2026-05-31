import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SalesPage() {
  const [, navigate] = useLocation();
  useEffect(() => { navigate("/sales-history", { replace: true }); }, []);
  return null;
}
