import { useParams } from 'react-router-dom';

export default function ProxyResultPage() {
  const { encodedUrl } = useParams();
  return (
    <main>
      <h1>Proxied Content</h1>
      <p>Encoded URL: {encodedUrl}</p>
      {/* TODO: Render proxied page content visually */}
    </main>
  );
}
