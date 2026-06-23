import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-8xl font-bold text-muted-foreground/20">404</h1>
        </div>
        <h2 className="text-2xl font-bold mb-4">الصفحة غير موجودة</h2>
        <p className="text-muted-foreground mb-8">
          عذراً، الصفحة التي تبحث عنها غير موجودة. قد تكون قد تم نقلها أو حذفها.
        </p>
        <Link href="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            العودة للرئيسية
          </Button>
        </Link>
      </div>
    </div>
  );
}
