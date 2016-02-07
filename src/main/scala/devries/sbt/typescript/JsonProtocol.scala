package devries.sbt.typescript

import spray.json.DefaultJsonProtocol

/**
  * Created by joost1 on 02/02/16.
  */
trait JsonProtocol extends DefaultJsonProtocol{
  implicit val coFormat = jsonFormat10(CompilerOptions)
  implicit val tscFormat = jsonFormat3(TsConfig)
}
