import { lazy, Suspense, useMemo } from "react";

import { useParams } from "react-router-dom";

import { useLanguage } from "@/contexts/LanguageContext";



const FabricDesignWorkspace = lazy(() => import("../engines/fabric/FabricDesignWorkspace"));



export default function PhotoEditorWorkspace() {

  const { draftId } = useParams();

  const { t } = useLanguage();



  const editor = useMemo(

    () => <FabricDesignWorkspace key={draftId ?? "new"} />,

    [draftId],

  );



  return (

    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">

      <Suspense

        fallback={

          <div className="flex items-center justify-center h-full text-muted-foreground">

            {t("seller.photoEditor.loading")}

          </div>

        }

      >

        {editor}

      </Suspense>

    </div>

  );

}

