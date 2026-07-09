import { IconMotorbike, IconCar, IconBus, IconTruck } from '@tabler/icons-react';

const iconMap = {
  moto: IconMotorbike,
  voiture: IconCar,
  minibus: IconBus,
  bus: IconBus,
  camion: IconTruck,
  truck: IconTruck,
};

function VehicleIcon({ type, size, color, ...props }) {
  const Icon = iconMap[type?.toLowerCase()] || IconCar;
  return <Icon size={size || 20} color={color} {...props} />;
}

export default VehicleIcon;
