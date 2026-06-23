import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Database,
  Users,
  Trophy,
  Shield,
  Zap,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">عن المنصة</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Chess.MR هي المنصة الرسمية للشطرنج في موريتانيا. نوفر تتبعاً شاملاً للبطولات
              والنتائج والتصنيفات للاعبين الموريتانيين.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8 text-center">المميزات</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Trophy className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>تغطية البطولات</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  تغطية شاملة للبطولات المحلية والدولية مع تحديثات مباشرة للنتائج والترتيب.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                    <Users className="h-6 w-6 text-emerald-600" />
                  </div>
                  <CardTitle>ملفات اللاعبين</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  ملفات شخصية شاملة لكل لاعب مع سجل البطولات والتقييمات والإحصائيات.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                    <Database className="h-6 w-6 text-amber-600" />
                  </div>
                  <CardTitle>بيانات موثوقة</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  جميع البيانات مستقاة من مصادر رسمية موثوقة ومحدثة بشكل منتظم.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                    <Globe className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle>تكامل Lichess</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  مزامنة تلقائية مع Lichess للحصول على تقييمات اللاعبين في الوقت الفعلي.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10">
                    <Zap className="h-6 w-6 text-purple-600" />
                  </div>
                  <CardTitle>أداء عالي</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  تجربة سريعة ومتجاوبة مع أفضل ممارسات الأداء من Next.js.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
                    <Shield className="h-6 w-6 text-red-600" />
                  </div>
                  <CardTitle>تصميم آمن</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  واجهة آمنة وموثوقة تحمي بياناتك مع دعم كامل للغة العربية.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8 text-center">مصادر البيانات</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Chess-Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground">
                  يتم استيراد جميع بيانات البطولات والنتائج من موقع Chess-Results.com،
                  المصدر الرسمي لنتائج البطولات المعتمدة من FIDE.
                </p>
                <Badge variant="outline">محدثة كل 5 دقائق</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lichess API</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground">
                  يتم الحصول على تقييمات اللاعبين من Lichess.org API، أكبر منصة شطرنج
                  مجانية في العالم.
                </p>
                <Badge variant="outline">محدثة كل 24 ساعة</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-8 text-center">التقنيات المستخدمة</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Next.js 15",
              "TypeScript",
              "TailwindCSS",
              "shadcn/ui",
              "Prisma",
              "PostgreSQL",
              "React Query",
              "Cloudflare R2",
            ].map((tech) => (
              <Badge key={tech} variant="secondary" className="px-4 py-2 text-sm">
                {tech}
              </Badge>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
