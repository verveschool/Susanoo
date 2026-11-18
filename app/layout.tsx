import type { Metadata } from 'next';
import { product } from '../lib/product';
import './globals.css';

export const metadata: Metadata = {
  title: product.demoName,
  description: 'Operational design demo using synthetic records only.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
