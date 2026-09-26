import ReleaseButton from './components/ReleaseButton';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">ReleaseKey</h1>
      <p className="mb-8 text-gray-600">SPEC §6: Human Verification Gate</p>
      {/* テスト用のダミーのレコードIDを渡してコンポーネントを呼び出す */}
      <ReleaseButton recordId="test-record-0x123456789" />
    </main>
  );
}
