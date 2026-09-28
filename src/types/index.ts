// ============================================================
// PMP Smart — Tipos compartidos entre Frontend y Backend
// ============================================================

export type RolUsuario = 'agricultor' | 'tecnico';

// ---- Cultivos ----

export interface Cultivo {
  id: string;
  nombre: string;
  variedad: string;
  hectareas: number;
  ubicacion: string;
  fechaSiembra: string;
  estadoFitosanitario: 'optimo' | 'observacion' | 'alerta';
  analisisCount: number;
  ultimaRevision: string;
}

export interface CreateCultivoDTO {
  nombre: string;
  variedad: string;
  hectareas: number;
  ubicacion: string;
  fechaSiembra: string;
  estadoFitosanitario?: 'optimo' | 'observacion' | 'alerta';
}

export interface UpdateCultivoDTO {
  nombre?: string;
  variedad?: string;
  hectareas?: number;
  ubicacion?: string;
  fechaSiembra?: string;
  estadoFitosanitario?: 'optimo' | 'observacion' | 'alerta';
  analisisCount?: number;
  ultimaRevision?: string;
}

// ---- Análisis ----

export type Diagnostico = 'Posible PMP' | 'Sano' | 'PMP Severo' | 'Deficiencia Nutricional';
export type EstadoAnalisis = 'alerta' | 'sano' | 'observacion';
export type Severidad = 'baja' | 'moderada' | 'alta' | 'ninguna';
export type EstadoRevision = 'sin_solicitar' | 'pendiente' | 'revisado';

export interface RevisionTecnica {
  tecnicoNombre: string;
  registroProfesional?: string;
  fechaRevision: string;
  diagnosticoValidado:
    | 'PMP Confirmado'
    | 'Sospecha Moderada'
    | 'Descartado - Sano'
    | 'Deficiencia Nutricional'
    | 'Virosis / Otra Afección';
  observaciones: string;
  tratamientoRecomendado: string;
}

export interface Analisis {
  id: string;
  cultivoId: string;
  cultivoNombre: string;
  fecha: string;
  imageUri: string;
  diagnostico: Diagnostico;
  estado: EstadoAnalisis;
  severidad: Severidad;
  confianza: number;
  sintomas: string[];
  recomendaciones: string[];
  notas?: string;
  estadoRevision: EstadoRevision;
  revisionTecnica?: RevisionTecnica;
}

export interface CreateAnalisisDTO {
  cultivoId: string;
  cultivoNombre: string;
  diagnostico: Diagnostico;
  estado: EstadoAnalisis;
  severidad: Severidad;
  confianza: number;
  sintomas: string[];
  recomendaciones: string[];
  notas?: string;
  estadoRevision?: EstadoRevision;
  /** Se envía la URI de la imagen o se sube como archivo */
  imageUri?: string;
}

export interface CreateRevisionDTO {
  tecnicoNombre: string;
  registroProfesional?: string;
  diagnosticoValidado: RevisionTecnica['diagnosticoValidado'];
  observaciones: string;
  tratamientoRecomendado: string;
}

// ---- Perfiles ----

export interface PerfilAgricultor {
  nombre: string;
  fincaPrincipal: string;
  ubicacion: string;
  telefono: string;
  email: string;
  notificaciones: boolean;
  modoOffline: boolean;
}

export interface PerfilTecnico {
  nombre: string;
  registroProfesional: string;
  especialidad: string;
  entidad: string;
  telefono: string;
  email: string;
  notificaciones: boolean;
}

export interface PerfilResponse {
  rol: RolUsuario;
  agricultor?: PerfilAgricultor;
  tecnico?: PerfilTecnico;
}

// ---- Auth ----

export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  nombre: string;
  rol: RolUsuario;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
}

// ---- API generics ----

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
