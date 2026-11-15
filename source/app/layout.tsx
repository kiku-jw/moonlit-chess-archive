import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Лунный гамбит · Шахматы для двоих',description:'Встретьтесь в лунном саду. Трёхмерные шахматы для двоих по приглашению.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}: {children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>}
