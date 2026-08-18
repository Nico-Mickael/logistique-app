import logoAdes from '../assets/logo-ades.jpeg';

function Logo({ height = 32, ...props }) {
  return (
    <img
      src={logoAdes}
      alt="ADES"
      style={{ height, width: 'auto', display: 'block', ...props.style }}
    />
  );
}

export default Logo;