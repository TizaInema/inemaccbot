import type { Fila } from './types.js';
export const FILAS: Fila[] = ['io', 'cpu', 'texto', 'render', 'chrome'];
export const CONCORRENCIAS: Record<Fila, number> = { io: 10, cpu: 2, texto: 2, render: 1, chrome: 1 };
