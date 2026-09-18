import { Equipment, Service, User } from '@/types';

export const mockServices: Service[] = [
  { id: 'uci', name: 'UCI', description: 'Unidad de Cuidados Intensivos' },
  { id: 'ambulancia', name: 'Ambulancia', description: 'Servicio de Ambulancia' },
  { id: 'esterilizacion', name: 'Esterilizacion', description: 'Central de Esterilización' },
  { id: 'hospitalizacion', name: 'Hospitalizacion', description: 'Servicio de Hospitalización' },
  { id: 'consulta-externa', name: 'Consulta Externa', description: 'Servicio de Consulta Externa' },
  { id: 'odontologia', name: 'Odontologia', description: 'Servicio de Odontología' },
  { id: 'cirugia', name: 'Cirugia', description: 'Salas de Cirugía' },
  { id: 'laboratorio-clinico', name: 'Laboratorio Clinico', description: 'Laboratorio Clínico' },
  { id: 'pre-transfusional', name: 'Pre-transfusional', description: 'Servicio Pre-transfusional' },
  { id: 'imagenes-diagnosticas', name: 'Imagenes Diagnosticas', description: 'Servicio de Imágenes Diagnósticas' },
  { id: 'farmacia', name: 'Farmacia', description: 'Servicio de Farmacia' },
  { id: 'sala-amiga', name: 'Sala Amiga', description: 'Sala Amiga de la Lactancia' }
];

export const mockEquipment: Equipment[] = [];

export const mockUser: User = {
  uid: 'user123',
  email: 'ingeniero@ucihonda.com.co',
  displayName: 'Ing. Biomédico',
  role: 'ADMIN',
  status: 'active'
};
