import type { DatabaseSync } from 'node:sqlite';
import type { Agora } from '../fila/types.js';
export class EstadoFluxos {constructor(readonly db:DatabaseSync,readonly agora:Agora) {}}
