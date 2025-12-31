const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        {/* App Logo */}
        <div className="w-24 h-24 mx-auto mb-6">
          <img src="/pin-logo.svg" alt="Mapka" className="w-full h-full" />
        </div>
        
        {/* App Name */}
        <div className="font-fredoka text-2xl font-bold text-foreground">
          Mapka
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
