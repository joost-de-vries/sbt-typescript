package name.devries.sbt.typescript

import spray.json.DefaultJsonProtocol

trait JsonProtocol extends DefaultJsonProtocol{
  implicit val coFormat = jsonFormat10(CompilerOptions)
  implicit val tscFormat = jsonFormat3(TsConfig)
}
