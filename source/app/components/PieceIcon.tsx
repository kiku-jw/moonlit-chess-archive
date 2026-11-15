export default function PieceIcon({type,color}:{type:string;color:'w'|'b'}){const fill=color==='w'?'#fff3df':'#282335',stroke=color==='w'?'#806745':'#b7a187';const paths:Record<string,React.ReactNode>={
p:<><circle cx="24" cy="14" r="7"/><path d="M20 22h8l-1 7 6 9H15l6-9z"/></>,
r:<><path d="M13 10h6v6h4v-6h4v6h4v-6h5v13l-5 4 2 11H15l2-11-4-4z"/><path d="M17 24h14" fill="none"/></>,
n:<><path d="M15 38c1-10 0-17 9-24l-1-7 7 6 6 2 4 9-4 5-8-4-1 7 6 6z"/><path d="M24 15c-6 0-11 9-11 16" fill="none"/><circle cx="32" cy="20" r="1.3" fill={stroke}/></>,
b:<><path d="M24 6c-6 7-10 11-8 17 1 4 4 6 8 6s7-2 8-6c2-6-2-10-8-17z"/><path d="M27 12l-5 9" fill="none"/><path d="M20 28h8l-1 4 6 6H15l6-6z"/></>,
q:<><path d="M12 16l6 7 6-12 6 12 6-7-6 16H18z"/><circle cx="12" cy="13" r="2.3"/><circle cx="24" cy="8" r="2.3"/><circle cx="36" cy="13" r="2.3"/><path d="M18 32h12l3 6H15z"/></>,
k:<><path d="M13 19l6 5 5-10 5 10 6-5-4 13H17z"/><circle cx="24" cy="9" r="3.5"/><path d="M17 32h14l2 6H15z"/></>};return <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true" fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">{paths[type]}<path d="M14 38h20l3 5H11z"/></svg>}
