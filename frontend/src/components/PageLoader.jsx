import { Center, Loader } from '@mantine/core';

export default function PageLoader({ height = 300 }) {
  return <Center h={height}><Loader color="brand" size="lg" /></Center>;
}
