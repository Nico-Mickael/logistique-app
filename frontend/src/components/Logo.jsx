import logoAdes from '../assets/logo-ades.jpeg';

function Logo({ height = 32 }) {
  return (
    <img
      src={logoAdes}
      alt="ADES"
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}

export default Logo;